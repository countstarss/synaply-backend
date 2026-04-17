import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  IssueStatus,
  IssueStateCategory,
  IssueType,
  Prisma,
  VisibilityType,
} from '../../prisma/generated/prisma/client';
import { CreateIssueDto } from './dto/create-issue.dto';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateWorkflowIssueDto } from './dto/create-workflow-issue.dto';
import { CreateIssueStepRecordDto } from './dto/create-issue-step-record.dto';
import { CreateIssueActivityDto } from './dto/create-issue-activity.dto';
import { QueryIssueDto, IssueScope } from './dto/query-issue.dto';
import { IssueStateService } from '../issue-state/issue-state.service';
import { PermissionService } from '../common/services/permission.service';
import { UpdateWorkflowRunStatusDto } from './dto/update-workflow-run-status.dto';
import { AdvanceWorkflowRunDto } from './dto/advance-workflow-run.dto';
import { RevertWorkflowRunDto } from './dto/revert-workflow-run.dto';
import { BlockWorkflowRunDto } from './dto/block-workflow-run.dto';
import { UnblockWorkflowRunDto } from './dto/unblock-workflow-run.dto';
import { RequestWorkflowReviewDto } from './dto/request-workflow-review.dto';
import { RequestWorkflowHandoffDto } from './dto/request-workflow-handoff.dto';
import { SubmitWorkflowRecordDto } from './dto/submit-workflow-record.dto';
import {
  RespondWorkflowReviewDto,
  WorkflowReviewOutcome,
} from './dto/respond-workflow-review.dto';
import { AcceptWorkflowHandoffDto } from './dto/accept-workflow-handoff.dto';
import {
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_RUN_EVENT_TYPES,
  WORKFLOW_RUN_STATUSES,
  type WorkflowActionType,
  type WorkflowActivityMetadata,
  type WorkflowRunStatus,
} from './workflow-run.constants';
import { InboxService } from '../inbox/inbox.service';

const issueDetailInclude = {
  state: true,
  project: true,
  assignees: {
    include: {
      member: {
        include: {
          user: true,
        },
      },
    },
  },
  labels: {
    include: {
      label: true,
    },
  },
} as const;

type IssueDetailRecord = Prisma.IssueGetPayload<{
  include: typeof issueDetailInclude;
}>;

type PrismaTx = Prisma.TransactionClient;

interface WorkflowNodeData {
  label?: string;
  assignee?: string;
  assigneeId?: string;
  assigneeName?: string;
}

interface WorkflowNode {
  id: string;
  data?: WorkflowNodeData;
}

interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
}

interface WorkflowSnapshot {
  name?: string;
  description?: string;
  templateId?: string;
  templateVersion?: string;
  templateStatus?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  [key: string]: unknown;
}

function parseJsonObject<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return value as T;
}

function isWorkflowActivityMetadata(
  metadata: unknown,
): metadata is WorkflowActivityMetadata {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }

  const record = metadata as Record<string, unknown>;
  return record.kind === 'workflow' && typeof record.eventType === 'string';
}

function mapRunStatusToActionType(
  runStatus: WorkflowRunStatus,
): WorkflowActionType {
  switch (runStatus) {
    case WORKFLOW_RUN_STATUSES.BLOCKED:
      return WORKFLOW_ACTION_TYPES.BLOCKED;
    case WORKFLOW_RUN_STATUSES.WAITING_REVIEW:
      return WORKFLOW_ACTION_TYPES.REVIEW;
    case WORKFLOW_RUN_STATUSES.HANDOFF_PENDING:
      return WORKFLOW_ACTION_TYPES.HANDOFF;
    case WORKFLOW_RUN_STATUSES.DONE:
      return WORKFLOW_ACTION_TYPES.DONE;
    default:
      return WORKFLOW_ACTION_TYPES.EXECUTION;
  }
}

function isWorkflowRunTransitionAllowed(
  currentStatus: WorkflowRunStatus,
  allowedStatuses: WorkflowRunStatus[],
) {
  return allowedStatuses.includes(currentStatus);
}

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly issueStateService: IssueStateService,
    private readonly permissionService: PermissionService,
    @Inject(forwardRef(() => InboxService))
    private readonly inboxService: InboxService,
  ) {}

  private async syncInboxForUsers(
    workspaceId: string,
    userIds: Array<string | null | undefined>,
  ) {
    const normalizedUserIds = Array.from(
      new Set(userIds.filter((userId): userId is string => Boolean(userId))),
    );

    if (normalizedUserIds.length === 0) {
      return;
    }

    try {
      await this.inboxService.syncInboxForUsers(workspaceId, normalizedUserIds);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown inbox sync error';
      console.warn(
        `Failed to sync inbox for workspace ${workspaceId}: ${message}`,
      );
    }
  }

  private async ensureIssueInWorkspace(issueId: string, workspaceId: string) {
    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        workspaceId,
      },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue ${issueId} 不存在于工作空间 ${workspaceId}`,
      );
    }

    return issue;
  }

  private async generateIssueKey(
    workspaceId: string,
  ): Promise<{ key: string; sequence: number }> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { issuePrefix: true, name: true },
    });

    const prefix =
      workspace?.issuePrefix ||
      workspace?.name?.substring(0, 3).toUpperCase() ||
      'ISS';

    const maxSequence = await this.prisma.issue.aggregate({
      where: { workspaceId },
      _max: { sequence: true },
    });

    const sequence = (maxSequence._max.sequence ?? 0) + 1;
    const key = `${prefix}-${sequence}`;

    return { key, sequence };
  }

  private parseWorkflowSnapshot(
    workflowSnapshot: unknown,
  ): WorkflowSnapshot | null {
    return parseJsonObject<WorkflowSnapshot>(workflowSnapshot);
  }

  private getWorkflowNodes(snapshot: WorkflowSnapshot | null) {
    return Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  }

  private getWorkflowEdges(snapshot: WorkflowSnapshot | null) {
    return Array.isArray(snapshot?.edges) ? snapshot.edges : [];
  }

  private getWorkflowNodeById(
    snapshot: WorkflowSnapshot | null,
    stepId?: string | null,
  ) {
    if (!stepId) {
      return null;
    }

    return (
      this.getWorkflowNodes(snapshot).find((node) => node.id === stepId) || null
    );
  }

  private getStartWorkflowNode(snapshot: WorkflowSnapshot | null) {
    const nodes = this.getWorkflowNodes(snapshot);
    const edges = this.getWorkflowEdges(snapshot);

    if (nodes.length === 0) {
      return null;
    }

    return (
      nodes.find((node) => !edges.some((edge) => edge.target === node.id)) ||
      nodes[0]
    );
  }

  private getNextWorkflowNode(
    snapshot: WorkflowSnapshot | null,
    stepId?: string | null,
  ) {
    if (!stepId) {
      return null;
    }

    const nextEdge = this.getWorkflowEdges(snapshot).find(
      (edge) => edge.source === stepId,
    );
    if (!nextEdge) {
      return null;
    }

    const nextNode = this.getWorkflowNodeById(snapshot, nextEdge.target);
    return nextNode
      ? {
          edge: nextEdge,
          node: nextNode,
        }
      : null;
  }

  private getPreviousWorkflowNode(
    snapshot: WorkflowSnapshot | null,
    stepId?: string | null,
  ) {
    if (!stepId) {
      return null;
    }

    const previousEdge = this.getWorkflowEdges(snapshot).find(
      (edge) => edge.target === stepId,
    );
    if (!previousEdge) {
      return null;
    }

    const previousNode = this.getWorkflowNodeById(
      snapshot,
      previousEdge.source,
    );
    return previousNode
      ? {
          edge: previousEdge,
          node: previousNode,
        }
      : null;
  }

  private getNodeIndex(
    snapshot: WorkflowSnapshot | null,
    nodeId?: string | null,
  ) {
    if (!nodeId) {
      return -1;
    }

    return this.getWorkflowNodes(snapshot).findIndex(
      (node) => node.id === nodeId,
    );
  }

  private buildWorkflowSnapshotFromTemplate(workflow: {
    id: string;
    name: string;
    version: string;
    status: string;
    json: unknown;
  }): WorkflowSnapshot {
    const parsedJson = parseJsonObject<WorkflowSnapshot>(workflow.json) || {};
    const nodes = Array.isArray(parsedJson.nodes) ? parsedJson.nodes : [];
    const edges = Array.isArray(parsedJson.edges) ? parsedJson.edges : [];

    return {
      ...parsedJson,
      name: workflow.name,
      templateId: workflow.id,
      templateVersion: workflow.version,
      templateStatus: workflow.status,
      description:
        typeof parsedJson.description === 'string'
          ? parsedJson.description
          : '',
      nodes,
      edges,
    };
  }

  private async resolveNodeAssigneeMemberId(
    workspaceId: string,
    node: WorkflowNode | null | undefined,
  ) {
    const assigneeUserId = node?.data?.assigneeId;
    if (!assigneeUserId) {
      return null;
    }

    try {
      return await this.teamMemberService.getTeamMemberIdByWorkspace(
        assigneeUserId,
        workspaceId,
      );
    } catch {
      return null;
    }
  }

  private async findIssueDetailById(
    workspaceId: string,
    issueId: string,
  ): Promise<IssueDetailRecord | null> {
    return this.prisma.issue.findFirst({
      where: {
        id: issueId,
        workspaceId,
      },
      include: issueDetailInclude,
    });
  }

  private async resolveTeamMemberUserId(teamMemberId?: string | null) {
    if (!teamMemberId) {
      return null;
    }

    const teamMember = await this.prisma.teamMember.findUnique({
      where: { id: teamMemberId },
      select: {
        userId: true,
      },
    });

    return teamMember?.userId ?? null;
  }

  private getIssueSignalSourceType(issue: {
    issueType?: IssueType | null;
    workflowId?: string | null;
    workflowSnapshot?: unknown;
  }) {
    if (
      issue.issueType === IssueType.WORKFLOW ||
      Boolean(issue.workflowId) ||
      Boolean(issue.workflowSnapshot)
    ) {
      return 'workflow';
    }

    return 'issue';
  }

  private async resolveIssueCreatorUserId(issue: {
    creatorId?: string | null;
    creatorMemberId?: string | null;
    creatorMember?: { userId?: string | null } | null;
  }) {
    if (issue.creatorMember?.userId) {
      return issue.creatorMember.userId;
    }

    const creatorMemberId = issue.creatorMemberId ?? issue.creatorId;
    if (!creatorMemberId) {
      return null;
    }

    return this.resolveTeamMemberUserId(creatorMemberId);
  }

  private async resolveCancelNotificationTargetUserIds(
    issue: {
      directAssigneeId?: string | null;
      assignees?: Array<{ memberId?: string | null }>;
    },
    actorUserId: string,
  ) {
    const targetMemberIds = new Set<string>();

    if (issue.directAssigneeId) {
      targetMemberIds.add(issue.directAssigneeId);
    }

    for (const assignee of issue.assignees || []) {
      if (assignee.memberId) {
        targetMemberIds.add(assignee.memberId);
      }
    }

    if (targetMemberIds.size === 0) {
      return [];
    }

    const targetMembers = await this.prisma.teamMember.findMany({
      where: {
        id: {
          in: Array.from(targetMemberIds),
        },
      },
      select: {
        userId: true,
      },
    });

    return Array.from(
      new Set(
        targetMembers
          .map((member) => member.userId)
          .filter(
            (targetUserId) => targetUserId && targetUserId !== actorUserId,
          ),
      ),
    );
  }

  private async notifyIssueCanceled(
    tx: PrismaTx,
    {
      workspaceId,
      workspaceName,
      issue,
      actorUserId,
      targetUserIds,
      canceledAt,
      cancelStateId,
    }: {
      workspaceId: string;
      workspaceName: string;
      issue: {
        id: string;
        key?: string | null;
        title: string;
        projectId?: string | null;
        project?: { name?: string | null } | null;
        issueType?: IssueType | null;
        workflowId?: string | null;
        workflowSnapshot?: unknown;
      };
      actorUserId: string;
      targetUserIds: string[];
      canceledAt: Date;
      cancelStateId: string;
    },
  ) {
    if (targetUserIds.length === 0) {
      return;
    }

    const sourceType = this.getIssueSignalSourceType(issue);
    const issueLabel = issue.key ? `${issue.key} ${issue.title}` : issue.title;
    const projectName = issue.project?.name || workspaceName;
    const baseData = {
      type: 'issue.canceled',
      bucket: 'following',
      sourceType,
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId: sourceType === 'workflow' ? issue.id : null,
      docId: null,
      actorUserId,
      title: `${issueLabel} 已取消`,
      summary: `创建者已取消这个 issue。它会从项目执行视图隐藏，但历史记录仍会保留。`,
      priority: 'normal',
      requiresAction: false,
      actionLabel: '查看记录',
      occurredAt: canceledAt,
      metadata: {
        kind: 'issue',
        eventType: 'issue.canceled',
        cancelStateId,
        managedBySync: false,
      } as Prisma.InputJsonValue,
    };

    for (const targetUserId of targetUserIds) {
      await tx.inboxItem.upsert({
        where: {
          workspaceId_targetUserId_dedupeKey: {
            workspaceId,
            targetUserId,
            dedupeKey: `issue.canceled:${issue.id}:${targetUserId}`,
          },
        },
        create: {
          workspaceId,
          targetUserId,
          dedupeKey: `issue.canceled:${issue.id}:${targetUserId}`,
          status: 'unread',
          ...baseData,
        },
        update: {
          ...baseData,
          status: 'unread',
          readAt: null,
          doneAt: null,
          dismissedAt: null,
          snoozedUntil: null,
        },
      });
    }
  }

  private async findLatestWorkflowActivityMetadata(issueId: string) {
    const activities = await this.prisma.issueActivity.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    for (const activity of activities) {
      if (isWorkflowActivityMetadata(activity.metadata)) {
        return activity.metadata;
      }
    }

    return null;
  }

  private buildWorkflowRunSummary(
    issue: Pick<
      IssueDetailRecord,
      | 'id'
      | 'workflowId'
      | 'workflowSnapshot'
      | 'currentStepId'
      | 'currentStepIndex'
      | 'currentStepStatus'
      | 'totalSteps'
      | 'issueType'
    >,
    latestWorkflowActivity?: { metadata?: unknown } | null,
  ) {
    if (
      issue.issueType !== IssueType.WORKFLOW &&
      !issue.workflowId &&
      !issue.workflowSnapshot
    ) {
      return null;
    }

    const snapshot = this.parseWorkflowSnapshot(issue.workflowSnapshot);
    const currentNode =
      this.getWorkflowNodeById(snapshot, issue.currentStepId) ||
      this.getWorkflowNodes(snapshot)[issue.currentStepIndex] ||
      null;

    const defaultRunStatus: WorkflowRunStatus =
      issue.currentStepStatus === IssueStatus.BLOCKED
        ? WORKFLOW_RUN_STATUSES.BLOCKED
        : issue.currentStepStatus === IssueStatus.DONE &&
            issue.currentStepIndex >= Math.max(issue.totalSteps - 1, 0)
          ? WORKFLOW_RUN_STATUSES.DONE
          : WORKFLOW_RUN_STATUSES.ACTIVE;

    const latestMetadata = isWorkflowActivityMetadata(
      latestWorkflowActivity?.metadata,
    )
      ? latestWorkflowActivity?.metadata
      : null;

    const runStatus = latestMetadata?.runStatus ?? defaultRunStatus;

    return {
      templateId: issue.workflowId ?? snapshot?.templateId ?? null,
      templateVersion: snapshot?.templateVersion ?? null,
      runStatus,
      currentActionType:
        latestMetadata?.actionType ?? mapRunStatusToActionType(runStatus),
      currentStepId: issue.currentStepId,
      currentStepIndex: issue.currentStepIndex,
      currentStepStatus: issue.currentStepStatus,
      currentStepName: currentNode?.data?.label ?? null,
      currentAssigneeUserId:
        latestMetadata?.assigneeUserId ?? currentNode?.data?.assigneeId ?? null,
      currentAssigneeName:
        latestMetadata?.assigneeName ??
        currentNode?.data?.assigneeName ??
        currentNode?.data?.assignee ??
        null,
      totalSteps: issue.totalSteps,
      lastEventType: latestMetadata?.eventType ?? null,
      blockedReason:
        runStatus === WORKFLOW_RUN_STATUSES.BLOCKED
          ? (latestMetadata?.reason ?? null)
          : null,
      targetUserId: latestMetadata?.targetUserId ?? null,
      targetName: latestMetadata?.targetName ?? null,
    };
  }

  private async enrichIssues<T extends IssueDetailRecord>(issues: T[]) {
    if (issues.length === 0) {
      return issues;
    }

    const workflowIssueIds = issues
      .filter(
        (issue) =>
          issue.issueType === IssueType.WORKFLOW ||
          Boolean(issue.workflowId) ||
          Boolean(issue.workflowSnapshot),
      )
      .map((issue) => issue.id);

    if (workflowIssueIds.length === 0) {
      return issues;
    }

    const activities = await this.prisma.issueActivity.findMany({
      where: {
        issueId: {
          in: workflowIssueIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const latestWorkflowActivityByIssueId = new Map<
      string,
      (typeof activities)[number]
    >();
    for (const activity of activities) {
      if (
        !latestWorkflowActivityByIssueId.has(activity.issueId) &&
        isWorkflowActivityMetadata(activity.metadata)
      ) {
        latestWorkflowActivityByIssueId.set(activity.issueId, activity);
      }
    }

    return issues.map((issue) => ({
      ...issue,
      workflowRun: this.buildWorkflowRunSummary(
        issue,
        latestWorkflowActivityByIssueId.get(issue.id),
      ),
    }));
  }

  private async createWorkflowActivity(
    tx: PrismaTx,
    {
      issueId,
      actorId,
      action,
      metadata,
    }: {
      issueId: string;
      actorId: string;
      action: string;
      metadata: WorkflowActivityMetadata;
    },
  ) {
    return tx.issueActivity.create({
      data: {
        issueId,
        actorId,
        action,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });
  }

  private async createWorkflowStepRecord(
    tx: PrismaTx,
    {
      issueId,
      assigneeId,
      stepId,
      stepName,
      index,
      resultText,
      attachments,
    }: {
      issueId: string;
      assigneeId: string;
      stepId: string;
      stepName: string;
      index: number;
      resultText?: string;
      attachments?: unknown;
    },
  ) {
    return tx.issueStepRecord.create({
      data: {
        issueId,
        assigneeId,
        stepId,
        stepName,
        index,
        resultText,
        attachments: attachments as Prisma.InputJsonValue,
      },
    });
  }

  private async buildWorkflowActorContext(
    userId: string,
    workspaceId: string,
    issueId: string,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    const actorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    const issue = await this.findIssueDetailById(workspaceId, issueId);
    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} 不存在`);
    }

    if (
      issue.issueType !== IssueType.WORKFLOW &&
      !issue.workflowId &&
      !issue.workflowSnapshot
    ) {
      throw new BadRequestException('该 Issue 不是 workflow run');
    }

    const snapshot = this.parseWorkflowSnapshot(issue.workflowSnapshot);
    const latestMetadata =
      await this.findLatestWorkflowActivityMetadata(issueId);
    const workflowRun = this.buildWorkflowRunSummary(
      issue,
      latestMetadata ? { metadata: latestMetadata } : null,
    );
    const currentNode =
      this.getWorkflowNodeById(snapshot, issue.currentStepId) ||
      this.getWorkflowNodes(snapshot)[issue.currentStepIndex] ||
      null;

    const currentAssigneeUserId =
      (await this.resolveTeamMemberUserId(issue.directAssigneeId)) ||
      currentNode?.data?.assigneeId;
    if (currentAssigneeUserId && currentAssigneeUserId !== userId) {
      throw new ForbiddenException('只有当前步骤负责人才能执行此操作');
    }

    return {
      actorId,
      issue,
      snapshot,
      currentNode,
      latestMetadata,
      workflowRun,
    };
  }

  private async buildWorkflowTargetContext(
    userId: string,
    workspaceId: string,
    issueId: string,
    expectedEventType:
      | typeof WORKFLOW_RUN_EVENT_TYPES.REVIEW_REQUESTED
      | typeof WORKFLOW_RUN_EVENT_TYPES.HANDOFF_REQUESTED,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    const actorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    const issue = await this.findIssueDetailById(workspaceId, issueId);
    if (!issue) {
      throw new NotFoundException(`Issue ${issueId} 不存在`);
    }

    if (
      issue.issueType !== IssueType.WORKFLOW &&
      !issue.workflowId &&
      !issue.workflowSnapshot
    ) {
      throw new BadRequestException('该 Issue 不是 workflow run');
    }

    const latestMetadata =
      await this.findLatestWorkflowActivityMetadata(issueId);
    if (!latestMetadata || latestMetadata.eventType !== expectedEventType) {
      throw new BadRequestException('当前 workflow run 没有待响应的协作请求');
    }

    if (
      !latestMetadata.targetUserId ||
      latestMetadata.targetUserId !== userId
    ) {
      throw new ForbiddenException('只有被指派的协作对象才能执行此操作');
    }

    const snapshot = this.parseWorkflowSnapshot(issue.workflowSnapshot);
    const currentNode =
      this.getWorkflowNodeById(snapshot, issue.currentStepId) ||
      this.getWorkflowNodes(snapshot)[issue.currentStepIndex] ||
      null;

    return {
      actorId,
      issue,
      snapshot,
      currentNode,
      latestMetadata,
    };
  }

  private assertWorkflowRunStatusAllowed(
    workflowRun: { runStatus: WorkflowRunStatus } | null | undefined,
    allowedStatuses: WorkflowRunStatus[],
    actionLabel: string,
  ) {
    const currentStatus =
      workflowRun?.runStatus ?? WORKFLOW_RUN_STATUSES.ACTIVE;

    if (isWorkflowRunTransitionAllowed(currentStatus, allowedStatuses)) {
      return;
    }

    switch (currentStatus) {
      case WORKFLOW_RUN_STATUSES.WAITING_REVIEW:
        throw new BadRequestException(
          `当前步骤正在等待 review，完成 review 响应后才能${actionLabel}`,
        );
      case WORKFLOW_RUN_STATUSES.HANDOFF_PENDING:
        throw new BadRequestException(
          `当前步骤正在等待接管，目标成员接受 handoff 后才能${actionLabel}`,
        );
      case WORKFLOW_RUN_STATUSES.BLOCKED:
        throw new BadRequestException(
          `当前步骤已被阻塞，解除阻塞后才能${actionLabel}`,
        );
      case WORKFLOW_RUN_STATUSES.DONE:
        throw new BadRequestException(
          `当前 workflow run 已完成，不能再${actionLabel}`,
        );
      default:
        throw new BadRequestException(`当前状态下不能${actionLabel}`);
    }
  }

  private async fetchWorkflowTemplateForRun(
    userId: string,
    workspaceId: string,
    workflowId: string,
  ) {
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      workflowId,
      'read',
    );

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id: workflowId,
        workspaceId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        version: true,
        json: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${workflowId} 不存在`);
    }

    return workflow;
  }

  async create(userId: string, createIssueDto: CreateIssueDto) {
    const {
      title,
      description,
      workspaceId,
      directAssigneeId,
      dueDate,
      stateId,
      projectId,
      visibility,
      priority,
      assigneeIds,
      labelIds,
    } = createIssueDto;

    const creatorMemberId =
      await this.teamMemberService.getTeamMemberIdByWorkspace(
        userId,
        workspaceId,
      );

    let finalStateId = stateId;
    if (!finalStateId) {
      const defaultState =
        await this.issueStateService.getDefaultState(workspaceId);
      finalStateId = defaultState?.id;
    }

    if (projectId) {
      await this.validateProjectBelongsToWorkspace(projectId, workspaceId);
    }

    const { key, sequence } = await this.generateIssueKey(workspaceId);

    const issue = await this.prisma.issue.create({
      data: {
        title,
        description,
        creatorId: creatorMemberId,
        creatorMemberId,
        directAssigneeId,
        dueDate,
        stateId: finalStateId,
        projectId,
        visibility: visibility ?? VisibilityType.TEAM_EDITABLE,
        priority,
        key,
        sequence,
        workspaceId,
      },
    });

    if (assigneeIds && assigneeIds.length > 0) {
      await this.prisma.issueAssignee.createMany({
        data: assigneeIds.map((memberId) => ({
          issueId: issue.id,
          memberId,
        })),
        skipDuplicates: true,
      });
    }

    if (labelIds && labelIds.length > 0) {
      await this.prisma.issueLabel.createMany({
        data: labelIds.map((labelId) => ({
          issueId: issue.id,
          labelId,
        })),
        skipDuplicates: true,
      });
    }

    return this.findOne(userId, workspaceId, issue.id);
  }

  async createWorkflowIssue(
    userId: string,
    createWorkflowIssueDto: CreateWorkflowIssueDto,
  ) {
    const {
      title,
      description,
      workspaceId,
      dueDate,
      workflowId,
      projectId,
      directAssigneeId,
      stateId,
      priority,
      visibility,
      assigneeIds,
      labelIds,
    } = createWorkflowIssueDto;

    const creatorMemberId =
      await this.teamMemberService.getTeamMemberIdByWorkspace(
        userId,
        workspaceId,
      );

    const workflow = await this.fetchWorkflowTemplateForRun(
      userId,
      workspaceId,
      workflowId,
    );

    if (workflow.status !== 'PUBLISHED') {
      throw new BadRequestException('只能基于已发布的工作流模板创建运行实例');
    }

    if (projectId) {
      await this.validateProjectBelongsToWorkspace(projectId, workspaceId);
    }

    let finalStateId = stateId;
    if (!finalStateId) {
      const defaultState =
        await this.issueStateService.getDefaultState(workspaceId);
      finalStateId = defaultState?.id;
    }

    const workflowSnapshot = this.buildWorkflowSnapshotFromTemplate(workflow);
    const startNode = this.getStartWorkflowNode(workflowSnapshot);

    if (!startNode) {
      throw new BadRequestException('该工作流模板没有可执行的起始节点');
    }

    const initialDirectAssigneeId =
      directAssigneeId ||
      (await this.resolveNodeAssigneeMemberId(workspaceId, startNode));
    const initialAssigneeUserId =
      (await this.resolveTeamMemberUserId(initialDirectAssigneeId)) ||
      startNode.data?.assigneeId ||
      null;

    const normalizedAssigneeIds = Array.from(
      new Set([
        ...(assigneeIds || []),
        ...(initialDirectAssigneeId ? [initialDirectAssigneeId] : []),
      ]),
    );

    const { key, sequence } = await this.generateIssueKey(workspaceId);

    const currentStepIndex = Math.max(
      this.getNodeIndex(workflowSnapshot, startNode.id),
      0,
    );
    const createdIssueId = await this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          title,
          description,
          workspaceId,
          workflowId,
          directAssigneeId: initialDirectAssigneeId,
          creatorId: creatorMemberId,
          creatorMemberId,
          dueDate,
          stateId: finalStateId,
          projectId,
          visibility: visibility ?? VisibilityType.TEAM_EDITABLE,
          priority,
          key,
          sequence,
          issueType: IssueType.WORKFLOW,
          totalSteps: this.getWorkflowNodes(workflowSnapshot).length,
          currentStepId: startNode.id,
          currentStepIndex,
          currentStepStatus: IssueStatus.TODO,
          workflowSnapshot: workflowSnapshot as Prisma.InputJsonValue,
        },
      });

      if (normalizedAssigneeIds.length > 0) {
        await tx.issueAssignee.createMany({
          data: normalizedAssigneeIds.map((memberId) => ({
            issueId: issue.id,
            memberId,
          })),
          skipDuplicates: true,
        });
      }

      if (labelIds && labelIds.length > 0) {
        await tx.issueLabel.createMany({
          data: labelIds.map((labelId) => ({
            issueId: issue.id,
            labelId,
          })),
          skipDuplicates: true,
        });
      }

      await this.createWorkflowActivity(tx, {
        issueId: issue.id,
        actorId: creatorMemberId,
        action: `基于模板 "${workflow.name}" 创建 workflow run`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.RUN_CREATED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: workflow.id,
          templateVersion: workflow.version,
          currentStepId: startNode.id,
          currentStepName: startNode.data?.label ?? null,
          currentStepIndex,
          assigneeUserId: startNode.data?.assigneeId ?? null,
          assigneeName:
            startNode.data?.assigneeName ?? startNode.data?.assignee ?? null,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId: issue.id,
        actorId: creatorMemberId,
        action: `开始步骤 "${startNode.data?.label || '未命名步骤'}"`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.STEP_STARTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: workflow.id,
          templateVersion: workflow.version,
          currentStepId: startNode.id,
          currentStepName: startNode.data?.label ?? null,
          currentStepIndex,
          assigneeUserId: startNode.data?.assigneeId ?? null,
          assigneeName:
            startNode.data?.assigneeName ?? startNode.data?.assignee ?? null,
        },
      });

      return issue.id;
    });

    await this.syncInboxForUsers(workspaceId, [userId, initialAssigneeUserId]);

    return this.findOne(userId, workspaceId, createdIssueId);
  }

  async findOne(userId: string, workspaceId: string, issueId: string) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'read',
    );

    const issue = await this.findIssueDetailById(workspaceId, issueId);
    if (!issue) {
      return null;
    }

    const [enrichedIssue] = await this.enrichIssues([issue]);
    return enrichedIssue;
  }

  async getWorkflowRun(userId: string, workspaceId: string, issueId: string) {
    const issue = await this.findOne(userId, workspaceId, issueId);
    if (!issue) {
      return null;
    }

    if (
      issue.issueType !== IssueType.WORKFLOW &&
      !issue.workflowId &&
      !issue.workflowSnapshot
    ) {
      throw new BadRequestException('该 Issue 不是 workflow run');
    }

    return issue;
  }

  async findAll(workspaceId: string, userId: string, query?: QueryIssueDto) {
    const teamMemberId =
      await this.teamMemberService.getTeamMemberIdByWorkspace(
        userId,
        workspaceId,
      );

    const where: Prisma.IssueWhereInput = {
      workspaceId,
    };

    if (query?.scope === IssueScope.PERSONAL) {
      where.visibility = VisibilityType.PRIVATE;
      where.creatorMemberId = teamMemberId;
    } else if (query?.scope === IssueScope.TEAM) {
      where.visibility = { not: VisibilityType.PRIVATE };
    } else {
      where.OR = [
        {
          visibility: {
            not: VisibilityType.PRIVATE,
          },
        },
        {
          creatorMemberId: teamMemberId,
        },
      ];
    }

    if (query?.stateId) {
      where.stateId = query.stateId;
    }

    if (query?.stateCategory) {
      where.state = { category: query.stateCategory };
    }

    if (query?.projectId) {
      where.projectId = query.projectId;
    }

    if (query?.assigneeId) {
      where.assignees = { some: { memberId: query.assigneeId } };
    }

    if (query?.labelId) {
      where.labels = { some: { labelId: query.labelId } };
    }

    if (query?.issueType) {
      where.issueType = query.issueType;
    }

    if (query?.priority) {
      where.priority = query.priority;
    }

    const orderBy: Prisma.IssueOrderByWithRelationInput = {};
    const sortField = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder || 'desc';
    orderBy[sortField] = sortOrder;

    const rawLimit = query?.limit as number | string | undefined;
    const parsedLimit =
      typeof rawLimit === 'number' ? rawLimit : Number(rawLimit);
    const take =
      Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;
    const cursor = query?.cursor ? { id: query.cursor } : undefined;
    const skip = cursor ? 1 : 0;

    const issues = await this.prisma.issue.findMany({
      where,
      orderBy,
      take,
      skip,
      cursor,
      include: issueDetailInclude,
    });

    return this.enrichIssues(issues);
  }

  async cancel(userId: string, workspaceId: string, issueId: string) {
    const actorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    const issue = await this.prisma.issue.findFirst({
      where: {
        id: issueId,
        workspaceId,
      },
      include: {
        state: true,
        project: {
          select: {
            name: true,
          },
        },
        workspace: {
          select: {
            name: true,
          },
        },
        creatorMember: {
          select: {
            userId: true,
          },
        },
        assignees: {
          select: {
            memberId: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue ${issueId} 不存在于工作空间 ${workspaceId}`,
      );
    }

    const creatorUserId = await this.resolveIssueCreatorUserId(issue);
    if (creatorUserId !== userId) {
      throw new ForbiddenException('只有创建者可以取消这个 Issue');
    }

    if (issue.state?.category === IssueStateCategory.CANCELED) {
      return this.findOne(userId, workspaceId, issueId);
    }

    const cancelState = await this.issueStateService.getStateByCategory(
      workspaceId,
      IssueStateCategory.CANCELED,
    );
    const targetUserIds = await this.resolveCancelNotificationTargetUserIds(
      issue,
      userId,
    );
    const canceledAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          stateId: cancelState.id,
        },
      });

      await tx.issueActivity.create({
        data: {
          issueId,
          actorId,
          action: '取消 Issue',
          metadata: {
            kind: 'issue',
            eventType: 'issue.canceled',
            previousStateId: issue.stateId,
            previousStateCategory: issue.state?.category ?? null,
            nextStateId: cancelState.id,
            nextStateCategory: IssueStateCategory.CANCELED,
            notifiedUserIds: targetUserIds,
          } as Prisma.InputJsonValue,
        },
      });

      await this.notifyIssueCanceled(tx, {
        workspaceId,
        workspaceName: issue.workspace.name,
        issue,
        actorUserId: userId,
        targetUserIds,
        canceledAt,
        cancelStateId: cancelState.id,
      });
    });

    return this.findOne(userId, workspaceId, issueId);
  }

  async update(
    userId: string,
    workspaceId: string,
    issueId: string,
    updateDto: Record<string, any>,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    if (updateDto.projectId !== undefined && updateDto.projectId !== null) {
      await this.validateProjectBelongsToWorkspace(
        updateDto.projectId,
        workspaceId,
      );
    }

    await this.prisma.issue.update({
      where: { id: issueId },
      data: updateDto,
    });

    return this.findOne(userId, workspaceId, issueId);
  }

  async remove(userId: string, workspaceId: string, issueId: string) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'delete',
    );

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  async updateWorkflowRunStatus(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: UpdateWorkflowRunStatusDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '更新步骤状态',
    );

    const assigneeMemberId = await this.resolveNodeAssigneeMemberId(
      workspaceId,
      currentNode,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepStatus: dto.status,
          directAssigneeId: assigneeMemberId ?? issue.directAssigneeId,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `步骤 "${currentNode?.data?.label || '未命名步骤'}" 状态更新为 ${dto.status}`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.STEP_STATUS_CHANGED,
          runStatus:
            dto.status === IssueStatus.BLOCKED
              ? WORKFLOW_RUN_STATUSES.BLOCKED
              : issue.currentStepStatus === IssueStatus.DONE &&
                  issue.currentStepIndex >= Math.max(issue.totalSteps - 1, 0)
                ? WORKFLOW_RUN_STATUSES.DONE
                : WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType:
            dto.status === IssueStatus.BLOCKED
              ? WORKFLOW_ACTION_TYPES.BLOCKED
              : WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode?.data?.assigneeId ?? null,
          assigneeName:
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          comment: dto.comment ?? null,
        },
      });
    });

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async advanceWorkflowRun(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: AdvanceWorkflowRunDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '推进步骤',
    );

    if (!currentNode) {
      throw new BadRequestException('当前 workflow run 没有有效的步骤节点');
    }

    if (issue.currentStepStatus !== IssueStatus.DONE) {
      throw new BadRequestException('当前步骤尚未完成，不能进入下一步');
    }

    const next = this.getNextWorkflowNode(snapshot, currentNode.id);
    const nextAssigneeMemberId = await this.resolveNodeAssigneeMemberId(
      workspaceId,
      next?.node,
    );
    const nextAssigneeUserId =
      (await this.resolveTeamMemberUserId(nextAssigneeMemberId)) ||
      next?.node.data?.assigneeId ||
      null;
    const normalizedIssueTitle = issue.title.trim();
    const normalizedTitleConfirmation =
      dto.issueTitleConfirmation?.trim() || null;
    const doneState = !next
      ? await this.issueStateService.getStateByCategory(
          workspaceId,
          IssueStateCategory.DONE,
        )
      : null;

    if (!next) {
      if (dto.completionConfirmed !== true) {
        throw new BadRequestException(
          '结束这个 workflow issue 前，请先确认已经和团队完成最终确认',
        );
      }

      if (!normalizedTitleConfirmation) {
        throw new BadRequestException(
          '结束这个 workflow issue 前，请先输入当前 issue 标题',
        );
      }

      if (normalizedTitleConfirmation !== normalizedIssueTitle) {
        throw new BadRequestException('输入的 issue 标题不匹配，无法结束流程');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.resultText || dto.attachments) {
        await this.createWorkflowStepRecord(tx, {
          issueId,
          assigneeId: actorId,
          stepId: currentNode.id,
          stepName: currentNode.data?.label || '未命名步骤',
          index: issue.currentStepIndex + 1,
          resultText: dto.resultText,
          attachments: dto.attachments,
        });

        await this.createWorkflowActivity(tx, {
          issueId,
          actorId,
          action: `提交步骤 "${currentNode.data?.label || '未命名步骤'}" 的成果记录`,
          metadata: {
            kind: 'workflow',
            eventType: WORKFLOW_RUN_EVENT_TYPES.RECORD_SUBMITTED,
            runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
            actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
            templateId: issue.workflowId,
            templateVersion: snapshot?.templateVersion ?? null,
            currentStepId: currentNode.id,
            currentStepName: currentNode.data?.label ?? null,
            currentStepIndex: issue.currentStepIndex,
            assigneeUserId: currentNode.data?.assigneeId ?? null,
            assigneeName:
              currentNode.data?.assigneeName ??
              currentNode.data?.assignee ??
              null,
            resultText: dto.resultText ?? null,
            comment: dto.comment ?? null,
          },
        });
      }

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `完成步骤 "${currentNode.data?.label || '未命名步骤'}"`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.STEP_COMPLETED,
          runStatus: next
            ? WORKFLOW_RUN_STATUSES.ACTIVE
            : WORKFLOW_RUN_STATUSES.DONE,
          actionType: next
            ? WORKFLOW_ACTION_TYPES.EXECUTION
            : WORKFLOW_ACTION_TYPES.DONE,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          previousStepId: currentNode.id,
          previousStepName: currentNode.data?.label ?? null,
          currentStepId: currentNode.id,
          currentStepName: currentNode.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode.data?.assigneeId ?? null,
          assigneeName:
            currentNode.data?.assigneeName ??
            currentNode.data?.assignee ??
            null,
          comment: dto.comment ?? null,
          resultText: dto.resultText ?? null,
        },
      });

      if (!next) {
        await tx.issue.update({
          where: { id: issueId },
          data: {
            currentStepStatus: IssueStatus.DONE,
            stateId: doneState?.id ?? issue.stateId,
          },
        });

        await this.createWorkflowActivity(tx, {
          issueId,
          actorId,
          action: `workflow run "${issue.title}" 已完成`,
          metadata: {
            kind: 'workflow',
            eventType: WORKFLOW_RUN_EVENT_TYPES.RUN_COMPLETED,
            runStatus: WORKFLOW_RUN_STATUSES.DONE,
            actionType: WORKFLOW_ACTION_TYPES.DONE,
            templateId: issue.workflowId,
            templateVersion: snapshot?.templateVersion ?? null,
            currentStepId: currentNode.id,
            currentStepName: currentNode.data?.label ?? null,
            currentStepIndex: issue.currentStepIndex,
            assigneeUserId: currentNode.data?.assigneeId ?? null,
            assigneeName:
              currentNode.data?.assigneeName ??
              currentNode.data?.assignee ??
              null,
          },
        });

        return;
      }

      const nextIndex = Math.max(this.getNodeIndex(snapshot, next.node.id), 0);
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepId: next.node.id,
          currentStepIndex: nextIndex,
          currentStepStatus: IssueStatus.TODO,
          directAssigneeId: nextAssigneeMemberId ?? issue.directAssigneeId,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `开始步骤 "${next.node.data?.label || '未命名步骤'}"`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.STEP_STARTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          previousStepId: currentNode.id,
          previousStepName: currentNode.data?.label ?? null,
          currentStepId: next.node.id,
          currentStepName: next.node.data?.label ?? null,
          currentStepIndex: nextIndex,
          assigneeUserId: next.node.data?.assigneeId ?? null,
          assigneeName:
            next.node.data?.assigneeName ?? next.node.data?.assignee ?? null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, nextAssigneeUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async revertWorkflowRun(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: RevertWorkflowRunDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '回退步骤',
    );

    if (!currentNode) {
      throw new BadRequestException('当前 workflow run 没有有效的步骤节点');
    }

    const previous = this.getPreviousWorkflowNode(snapshot, currentNode.id);
    if (!previous) {
      throw new BadRequestException('当前步骤已经是起始步骤，不能回退');
    }

    const previousIndex = Math.max(
      this.getNodeIndex(snapshot, previous.node.id),
      0,
    );
    const previousAssigneeMemberId = await this.resolveNodeAssigneeMemberId(
      workspaceId,
      previous.node,
    );
    const previousAssigneeUserId =
      (await this.resolveTeamMemberUserId(previousAssigneeMemberId)) ||
      previous.node.data?.assigneeId ||
      null;

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepId: previous.node.id,
          currentStepIndex: previousIndex,
          currentStepStatus: IssueStatus.TODO,
          directAssigneeId: previousAssigneeMemberId ?? issue.directAssigneeId,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `从 "${currentNode.data?.label || '未命名步骤'}" 回退到 "${previous.node.data?.label || '未命名步骤'}"`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.STEP_REVERTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          previousStepId: currentNode.id,
          previousStepName: currentNode.data?.label ?? null,
          currentStepId: previous.node.id,
          currentStepName: previous.node.data?.label ?? null,
          currentStepIndex: previousIndex,
          assigneeUserId: previous.node.data?.assigneeId ?? null,
          assigneeName:
            previous.node.data?.assigneeName ??
            previous.node.data?.assignee ??
            null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, previousAssigneeUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async blockWorkflowRun(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: BlockWorkflowRunDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '标记阻塞',
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepStatus: IssueStatus.BLOCKED,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `阻塞步骤 "${currentNode?.data?.label || '未命名步骤'}"`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.BLOCKED,
          runStatus: WORKFLOW_RUN_STATUSES.BLOCKED,
          actionType: WORKFLOW_ACTION_TYPES.BLOCKED,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode?.data?.assigneeId ?? null,
          assigneeName:
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          reason: dto.reason ?? null,
        },
      });
    });

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async unblockWorkflowRun(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: UnblockWorkflowRunDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.BLOCKED],
      '解除阻塞',
    );

    const restoreStatus = dto.restoreStatus ?? IssueStatus.IN_PROGRESS;

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepStatus: restoreStatus,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `解除步骤 "${currentNode?.data?.label || '未命名步骤'}" 的阻塞`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.UNBLOCKED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode?.data?.assigneeId ?? null,
          assigneeName:
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          comment: dto.comment ?? null,
        },
      });
    });

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async requestWorkflowReview(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: RequestWorkflowReviewDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '请求 review',
    );

    if (!dto.targetUserId) {
      throw new BadRequestException('请求 review 时必须指定目标成员');
    }

    if (dto.targetUserId === userId) {
      throw new BadRequestException('不能把 review 请求发送给自己');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepStatus:
            issue.currentStepStatus === IssueStatus.DONE
              ? IssueStatus.DONE
              : IssueStatus.AMOST_DONE,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `为步骤 "${currentNode?.data?.label || '未命名步骤'}" 请求 review`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.REVIEW_REQUESTED,
          runStatus: WORKFLOW_RUN_STATUSES.WAITING_REVIEW,
          actionType: WORKFLOW_ACTION_TYPES.REVIEW,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode?.data?.assigneeId ?? null,
          assigneeName:
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          targetUserId: dto.targetUserId ?? null,
          targetName: dto.targetName ?? null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, dto.targetUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async respondWorkflowReview(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: RespondWorkflowReviewDto,
  ) {
    const { actorId, issue, snapshot, currentNode, latestMetadata } =
      await this.buildWorkflowTargetContext(
        userId,
        workspaceId,
        issueId,
        WORKFLOW_RUN_EVENT_TYPES.REVIEW_REQUESTED,
      );

    const isApproved = dto.outcome === WorkflowReviewOutcome.APPROVED;
    const nextStepStatus = isApproved
      ? IssueStatus.DONE
      : IssueStatus.IN_PROGRESS;
    const assigneeUserId =
      latestMetadata.assigneeUserId ?? currentNode?.data?.assigneeId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          currentStepStatus: nextStepStatus,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: isApproved
          ? `确认步骤 "${currentNode?.data?.label || '未命名步骤'}" 的 review`
          : `为步骤 "${currentNode?.data?.label || '未命名步骤'}" 请求修改`,
        metadata: {
          kind: 'workflow',
          eventType: isApproved
            ? WORKFLOW_RUN_EVENT_TYPES.REVIEW_APPROVED
            : WORKFLOW_RUN_EVENT_TYPES.REVIEW_CHANGES_REQUESTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId,
          assigneeName:
            latestMetadata.assigneeName ??
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          targetUserId: userId,
          targetName: latestMetadata.targetName ?? null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, assigneeUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async requestWorkflowHandoff(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: RequestWorkflowHandoffDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '发起交接',
    );

    if (!dto.targetUserId) {
      throw new BadRequestException('请求交接时必须指定目标成员');
    }

    if (dto.targetUserId === userId) {
      throw new BadRequestException('不能把 handoff 请求发送给自己');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `为步骤 "${currentNode?.data?.label || '未命名步骤'}" 请求交接`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.HANDOFF_REQUESTED,
          runStatus: WORKFLOW_RUN_STATUSES.HANDOFF_PENDING,
          actionType: WORKFLOW_ACTION_TYPES.HANDOFF,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode?.data?.assigneeId ?? null,
          assigneeName:
            currentNode?.data?.assigneeName ??
            currentNode?.data?.assignee ??
            null,
          targetUserId: dto.targetUserId ?? null,
          targetName: dto.targetName ?? null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, dto.targetUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async acceptWorkflowHandoff(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: AcceptWorkflowHandoffDto,
  ) {
    const { actorId, issue, snapshot, currentNode, latestMetadata } =
      await this.buildWorkflowTargetContext(
        userId,
        workspaceId,
        issueId,
        WORKFLOW_RUN_EVENT_TYPES.HANDOFF_REQUESTED,
      );
    const previousAssigneeUserId =
      latestMetadata.assigneeUserId ?? currentNode?.data?.assigneeId ?? null;

    await this.prisma.$transaction(async (tx) => {
      await tx.issue.update({
        where: { id: issueId },
        data: {
          directAssigneeId: actorId,
          currentStepStatus:
            issue.currentStepStatus === IssueStatus.TODO
              ? IssueStatus.IN_PROGRESS
              : issue.currentStepStatus,
        },
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `接受步骤 "${currentNode?.data?.label || '未命名步骤'}" 的交接`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.HANDOFF_ACCEPTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode?.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: userId,
          assigneeName: latestMetadata.targetName ?? null,
          targetUserId: userId,
          targetName: latestMetadata.targetName ?? null,
          comment: dto.comment ?? null,
        },
      });
    });

    await this.syncInboxForUsers(workspaceId, [userId, previousAssigneeUserId]);

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async submitWorkflowRecord(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: SubmitWorkflowRecordDto,
  ) {
    const { actorId, issue, snapshot, currentNode, workflowRun } =
      await this.buildWorkflowActorContext(userId, workspaceId, issueId);

    this.assertWorkflowRunStatusAllowed(
      workflowRun,
      [WORKFLOW_RUN_STATUSES.ACTIVE],
      '提交步骤记录',
    );

    if (!currentNode) {
      throw new BadRequestException('当前 workflow run 没有有效的步骤节点');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.createWorkflowStepRecord(tx, {
        issueId,
        assigneeId: actorId,
        stepId: currentNode.id,
        stepName: currentNode.data?.label || '未命名步骤',
        index: issue.currentStepIndex + 1,
        resultText: dto.resultText,
        attachments: dto.attachments,
      });

      await this.createWorkflowActivity(tx, {
        issueId,
        actorId,
        action: `提交步骤 "${currentNode.data?.label || '未命名步骤'}" 的成果记录`,
        metadata: {
          kind: 'workflow',
          eventType: WORKFLOW_RUN_EVENT_TYPES.RECORD_SUBMITTED,
          runStatus: WORKFLOW_RUN_STATUSES.ACTIVE,
          actionType: WORKFLOW_ACTION_TYPES.EXECUTION,
          templateId: issue.workflowId,
          templateVersion: snapshot?.templateVersion ?? null,
          currentStepId: issue.currentStepId,
          currentStepName: currentNode.data?.label ?? null,
          currentStepIndex: issue.currentStepIndex,
          assigneeUserId: currentNode.data?.assigneeId ?? null,
          assigneeName:
            currentNode.data?.assigneeName ??
            currentNode.data?.assignee ??
            null,
          resultText: dto.resultText ?? null,
        },
      });
    });

    return this.getWorkflowRun(userId, workspaceId, issueId);
  }

  async addStepRecord(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: CreateIssueStepRecordDto,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    const assigneeTeamMemberId =
      await this.teamMemberService.getTeamMemberIdByWorkspace(
        dto.assigneeId,
        workspaceId,
      );

    return this.prisma.issueStepRecord.create({
      data: {
        issueId,
        stepId: dto.stepId,
        stepName: dto.stepName,
        index: dto.index,
        resultText: dto.resultText,
        attachments: dto.attachments as Prisma.InputJsonValue,
        assigneeId: assigneeTeamMemberId,
      },
      include: {
        assignee: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async listStepRecords(userId: string, workspaceId: string, issueId: string) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'read',
    );

    return this.prisma.issueStepRecord.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
      include: {
        assignee: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async addIssueActivity(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: CreateIssueActivityDto,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    const actorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    return this.prisma.issueActivity.create({
      data: {
        issueId,
        actorId,
        action: dto.action,
        metadata: dto.metadata as Prisma.InputJsonValue,
      },
      include: {
        actor: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async listIssueActivities(
    userId: string,
    workspaceId: string,
    issueId: string,
  ) {
    await this.ensureIssueInWorkspace(issueId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'read',
    );

    return this.prisma.issueActivity.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
      include: {
        actor: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  private async validateProjectBelongsToWorkspace(
    projectId: string,
    workspaceId: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    });

    if (!project) {
      throw new NotFoundException(`项目 ${projectId} 不存在`);
    }

    if (project.workspaceId !== workspaceId) {
      throw new BadRequestException('projectId 对应的项目不属于当前工作空间');
    }
  }
}
