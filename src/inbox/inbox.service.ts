import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, InboxItem as InboxItemRecord, IssuePriority, IssueStateCategory, IssueStatus } from '../../prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { IssueService } from '../issue/issue.service';
import { QueryInboxDto } from './dto/query-inbox.dto';
import { SnoozeInboxItemDto } from './dto/snooze-inbox-item.dto';
import {
  InboxActionDefinition,
  InboxBucket,
  InboxFeedItem,
  InboxFeedResponse,
  InboxItemPriority,
  InboxItemStatus,
  InboxItemType,
  InboxSourceType,
  InboxSummary,
  MyWorkInboxSignal,
} from './inbox.types';

interface WorkspaceWorkflowRun {
  runStatus:
    | 'ACTIVE'
    | 'BLOCKED'
    | 'WAITING_REVIEW'
    | 'HANDOFF_PENDING'
    | 'DONE';
  currentStepName?: string | null;
  currentAssigneeUserId?: string | null;
  blockedReason?: string | null;
  targetUserId?: string | null;
}

type WorkspaceIssue = Awaited<ReturnType<IssueService['findAll']>>[number] & {
  workflowRun?: WorkspaceWorkflowRun | null;
};

const projectSignalSelect = {
  id: true,
  name: true,
  riskLevel: true,
  updatedAt: true,
  owner: {
    select: {
      id: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.ProjectSelect;

type ProjectSignalRecord = Prisma.ProjectGetPayload<{
  select: typeof projectSignalSelect;
}>;

interface InboxSignalDraft {
  dedupeKey: string;
  type: InboxItemType;
  bucket: InboxBucket;
  sourceType: InboxSourceType;
  sourceId: string;
  projectId: string | null;
  projectName: string | null;
  issueId: string | null;
  issueKey: string | null;
  workflowRunId: string | null;
  docId: string | null;
  actorUserId: string | null;
  title: string;
  summary: string | null;
  priority: InboxItemPriority;
  requiresAction: boolean;
  actionLabel: string | null;
  occurredAt: Date;
  metadata: Record<string, unknown> | null;
}

const PRIORITY_ORDER: Record<InboxItemPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

const TYPE_ORDER: Record<InboxItemType, number> = {
  'workflow.review.requested': 100,
  'workflow.handoff.requested': 96,
  'workflow.blocked': 92,
  'deadline.soon': 88,
  'issue.assigned': 84,
  'project.risk.flagged': 80,
  'digest.generated': 20,
};

function parseMetadata(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getDayDistance(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function getIssueSignalSourceType(issue: WorkspaceIssue): InboxSourceType {
  if (issue.workflowRun || issue.workflowId || issue.issueType === 'WORKFLOW') {
    return 'workflow';
  }

  return 'issue';
}

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly issueService: IssueService,
  ) {}

  private isCompleted(issue: WorkspaceIssue) {
    return Boolean(
      issue.workflowRun?.runStatus === 'DONE' ||
        issue.currentStepStatus === IssueStatus.DONE ||
        issue.state?.category === IssueStateCategory.DONE,
    );
  }

  private isBlocked(issue: WorkspaceIssue) {
    return Boolean(
      issue.workflowRun?.runStatus === 'BLOCKED' ||
        issue.currentStepStatus === IssueStatus.BLOCKED,
    );
  }

  private isAssignedToUser(
    issue: WorkspaceIssue,
    userId: string,
    teamMemberId: string,
  ) {
    if (issue.directAssigneeId === teamMemberId) {
      return true;
    }

    if (issue.assignees?.some((assignee) => assignee.memberId === teamMemberId)) {
      return true;
    }

    return issue.workflowRun?.currentAssigneeUserId === userId;
  }

  private normalizePriority(priority: IssuePriority | null | undefined) {
    switch (priority) {
      case IssuePriority.LOW:
        return 'low';
      case IssuePriority.HIGH:
        return 'high';
      case IssuePriority.URGENT:
        return 'urgent';
      case IssuePriority.NORMAL:
      default:
        return 'normal';
    }
  }

  private isHighRisk(level: string | null | undefined) {
    return level === 'HIGH' || level === 'CRITICAL';
  }

  private isCriticalRisk(level: string | null | undefined) {
    return level === 'CRITICAL';
  }

  private buildAvailableActions(
    record: Pick<
      InboxItemRecord,
      'status' | 'type' | 'actionLabel' | 'requiresAction'
    >,
  ): InboxActionDefinition[] {
    const status = record.status as InboxItemStatus;

    if (status === 'done' || status === 'dismissed') {
      return [
        {
          key: 'open',
          label: record.actionLabel || 'Open context',
        },
      ];
    }

    const baseActions: InboxActionDefinition[] = [
      {
        key: 'open',
        label: record.actionLabel || 'Open context',
      },
      {
        key: 'mark_done',
        label: 'Mark as done',
      },
      {
        key: 'snooze',
        label: 'Snooze 1d',
      },
    ];

    if (status !== 'snoozed') {
      baseActions.splice(1, 0, {
        key: 'toggle_read',
        label: status === 'unread' ? 'Mark read' : 'Mark unread',
      });
    }

    if (record.type === 'workflow.handoff.requested') {
      return [
        { key: 'accept_handoff', label: 'Accept handoff' },
        ...baseActions,
      ];
    }

    return baseActions;
  }

  private mapRecord(record: InboxItemRecord): InboxFeedItem {
    return {
      id: record.id,
      type: record.type as InboxItemType,
      bucket: record.bucket as InboxBucket,
      title: record.title,
      summary: record.summary,
      priority: record.priority as InboxItemPriority,
      status: record.status as InboxItemStatus,
      requiresAction: record.requiresAction,
      sourceType: record.sourceType as InboxSourceType,
      sourceId: record.sourceId,
      projectId: record.projectId,
      projectName: record.projectName,
      issueId: record.issueId,
      issueKey: record.issueKey,
      workflowRunId: record.workflowRunId,
      docId: record.docId,
      actionLabel: record.actionLabel,
      occurredAt: record.occurredAt.toISOString(),
      metadata: parseMetadata(record.metadata),
      availableActions: this.buildAvailableActions(record),
    };
  }

  private sortFeedItems(items: InboxFeedItem[]) {
    return [...items].sort((left, right) => {
      if (left.requiresAction !== right.requiresAction) {
        return left.requiresAction ? -1 : 1;
      }

      const priorityDelta =
        PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority];
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const typeDelta = TYPE_ORDER[right.type] - TYPE_ORDER[left.type];
      if (typeDelta !== 0) {
        return typeDelta;
      }

      return (
        new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()
      );
    });
  }

  private parseRequiresActionFilter(value?: string) {
    if (value === undefined) {
      return undefined;
    }

    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return undefined;
  }

  private filterFeedItems(items: InboxFeedItem[], query: QueryInboxDto) {
    const requiresAction = this.parseRequiresActionFilter(query.requiresAction);

    return items.filter((item) => {
      if (query.bucket && item.bucket !== query.bucket) {
        return false;
      }

      if (query.status && item.status !== query.status) {
        return false;
      }

      if (query.type && item.type !== query.type) {
        return false;
      }

      if (query.projectId && item.projectId !== query.projectId) {
        return false;
      }

      if (
        requiresAction !== undefined &&
        item.requiresAction !== requiresAction
      ) {
        return false;
      }

      return true;
    });
  }

  private buildSummary(
    activeItems: InboxFeedItem[],
    allItems: InboxFeedItem[] = activeItems,
  ): InboxSummary {
    const summary = activeItems.reduce<InboxSummary>(
      (state, item) => {
        if (item.bucket === 'needs-response') {
          state.needsResponse += 1;
        } else if (item.bucket === 'needs-attention') {
          state.needsAttention += 1;
        } else if (item.bucket === 'following') {
          state.following += 1;
        } else {
          state.digest += 1;
        }

        if (item.status === 'unread') {
          state.unread += 1;
        }

        return state;
      },
      {
        needsResponse: 0,
        needsAttention: 0,
        following: 0,
        digest: 0,
        unread: 0,
        snoozed: 0,
        done: 0,
      },
    );

    for (const item of allItems) {
      if (item.status === 'snoozed') {
        summary.snoozed += 1;
      }

      if (item.status === 'done') {
        summary.done += 1;
      }
    }

    return summary;
  }

  private buildAssignmentSignal(
    issue: WorkspaceIssue,
    workspaceName: string,
    userId: string,
    teamMemberId: string,
  ): InboxSignalDraft | null {
    if (!this.isAssignedToUser(issue, userId, teamMemberId)) {
      return null;
    }

    if (this.isCompleted(issue) || this.isBlocked(issue)) {
      return null;
    }

    if (
      issue.workflowRun?.runStatus === 'WAITING_REVIEW' ||
      issue.workflowRun?.runStatus === 'HANDOFF_PENDING'
    ) {
      return null;
    }

    const sourceType = getIssueSignalSourceType(issue);
    const occurredAt = issue.updatedAt;
    const freshThreshold = getDayDistance(occurredAt, new Date());

    if (freshThreshold > 10) {
      return null;
    }

    return {
      dedupeKey: `issue.assigned:${issue.id}:${userId}`,
      type: 'issue.assigned',
      bucket: 'needs-response',
      sourceType,
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId: sourceType === 'workflow' ? issue.id : null,
      docId: null,
      actorUserId: null,
      title: `${issue.title} was assigned to you`,
      summary:
        issue.workflowRun?.currentStepName
          ? `Pick up "${issue.workflowRun.currentStepName}" and move it forward.`
          : `This issue is now sitting with you in ${issue.project?.name || workspaceName}.`,
      priority: this.normalizePriority(issue.priority),
      requiresAction: true,
      actionLabel: 'Open issue',
      occurredAt,
      metadata: {
        managedBySync: true,
        stepName: issue.workflowRun?.currentStepName || null,
      },
    };
  }

  private buildReviewSignal(
    issue: WorkspaceIssue,
    workspaceName: string,
    userId: string,
  ): InboxSignalDraft | null {
    if (
      issue.workflowRun?.runStatus !== 'WAITING_REVIEW' ||
      issue.workflowRun.targetUserId !== userId
    ) {
      return null;
    }

    return {
      dedupeKey: `workflow.review.requested:${issue.id}:${userId}`,
      type: 'workflow.review.requested',
      bucket: 'needs-response',
      sourceType: 'workflow',
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId: issue.id,
      docId: null,
      actorUserId: null,
      title: `Review requested on ${issue.title}`,
      summary: issue.workflowRun.currentStepName
        ? `The step "${issue.workflowRun.currentStepName}" is waiting for your review.`
        : 'A workflow step is waiting for your review.',
      priority:
        issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
      requiresAction: true,
      actionLabel: 'Open review',
      occurredAt: issue.updatedAt,
      metadata: {
        managedBySync: true,
        stepName: issue.workflowRun.currentStepName || null,
      },
    };
  }

  private buildHandoffSignal(
    issue: WorkspaceIssue,
    workspaceName: string,
    userId: string,
  ): InboxSignalDraft | null {
    if (
      issue.workflowRun?.runStatus !== 'HANDOFF_PENDING' ||
      issue.workflowRun.targetUserId !== userId
    ) {
      return null;
    }

    return {
      dedupeKey: `workflow.handoff.requested:${issue.id}:${userId}`,
      type: 'workflow.handoff.requested',
      bucket: 'needs-response',
      sourceType: 'workflow',
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId: issue.id,
      docId: null,
      actorUserId: null,
      title: `Handoff requested on ${issue.title}`,
      summary: issue.workflowRun.currentStepName
        ? `The step "${issue.workflowRun.currentStepName}" is waiting for you to take over.`
        : 'A workflow step is waiting for you to take over.',
      priority:
        issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
      requiresAction: true,
      actionLabel: 'Accept handoff',
      occurredAt: issue.updatedAt,
      metadata: {
        managedBySync: true,
        stepName: issue.workflowRun.currentStepName || null,
      },
    };
  }

  private buildBlockedSignal(
    issue: WorkspaceIssue,
    workspaceName: string,
    project: ProjectSignalRecord | null,
    userId: string,
    teamMemberId: string,
  ): InboxSignalDraft | null {
    if (!this.isBlocked(issue)) {
      return null;
    }

    const isCurrentOwner = this.isAssignedToUser(issue, userId, teamMemberId);
    const isProjectOwner = project?.owner.user?.id === userId;

    if (!isCurrentOwner && !isProjectOwner) {
      return null;
    }

    return {
      dedupeKey: `workflow.blocked:${issue.id}:${userId}`,
      type: 'workflow.blocked',
      bucket: 'needs-attention',
      sourceType: getIssueSignalSourceType(issue),
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId:
        getIssueSignalSourceType(issue) === 'workflow' ? issue.id : null,
      docId: null,
      actorUserId: null,
      title: `${issue.title} is blocked`,
      summary:
        issue.workflowRun?.blockedReason ||
        'The current work is blocked and needs a clear unblock owner.',
      priority:
        issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
      requiresAction: false,
      actionLabel: 'Open blocker',
      occurredAt: issue.updatedAt,
      metadata: {
        managedBySync: true,
        blockedReason: issue.workflowRun?.blockedReason || null,
        stepName: issue.workflowRun?.currentStepName || null,
      },
    };
  }

  private buildDeadlineSignal(
    issue: WorkspaceIssue,
    workspaceName: string,
    userId: string,
    teamMemberId: string,
  ): InboxSignalDraft | null {
    if (!issue.dueDate) {
      return null;
    }

    if (!this.isAssignedToUser(issue, userId, teamMemberId) || this.isCompleted(issue)) {
      return null;
    }

    const dueAt = new Date(issue.dueDate);
    const dayDistance = getDayDistance(new Date(), dueAt);

    if (dayDistance > 3) {
      return null;
    }

    const isOverdue = dueAt.getTime() < Date.now();

    return {
      dedupeKey: `deadline.soon:${issue.id}:${userId}:${dueAt.toISOString().slice(0, 10)}`,
      type: 'deadline.soon',
      bucket: 'needs-response',
      sourceType: getIssueSignalSourceType(issue),
      sourceId: issue.id,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      issueId: issue.id,
      issueKey: issue.key || null,
      workflowRunId:
        getIssueSignalSourceType(issue) === 'workflow' ? issue.id : null,
      docId: null,
      actorUserId: null,
      title: isOverdue
        ? `${issue.title} is overdue`
        : `${issue.title} is due soon`,
      summary: isOverdue
        ? 'The due date has passed and this item now risks delivery momentum.'
        : `The due date is ${dueAt.toISOString().slice(0, 10)}.`,
      priority: isOverdue ? 'urgent' : 'high',
      requiresAction: true,
      actionLabel: 'Open due item',
      occurredAt: dueAt,
      metadata: {
        managedBySync: true,
        dueAt: dueAt.toISOString(),
      },
    };
  }

  private buildProjectRiskSignal(
    project: ProjectSignalRecord,
    userId: string,
  ): InboxSignalDraft | null {
    if (project.owner.user?.id !== userId || !this.isHighRisk(project.riskLevel)) {
      return null;
    }

    const riskLabel = project.riskLevel.toLowerCase();

    return {
      dedupeKey: `project.risk.flagged:${project.id}:${userId}:${project.riskLevel}`,
      type: 'project.risk.flagged',
      bucket: 'needs-attention',
      sourceType: 'project',
      sourceId: project.id,
      projectId: project.id,
      projectName: project.name,
      issueId: null,
      issueKey: null,
      workflowRunId: null,
      docId: null,
      actorUserId: null,
      title: `${project.name} is flagged at ${riskLabel} risk`,
      summary: 'Review blockers, deadlines, and pending confirmations before momentum slips.',
      priority: this.isCriticalRisk(project.riskLevel) ? 'urgent' : 'high',
      requiresAction: false,
      actionLabel: 'Open project',
      occurredAt: project.updatedAt,
      metadata: {
        managedBySync: true,
        riskLevel: project.riskLevel,
      },
    };
  }

  private async collectSignalsForUser(
    workspaceId: string,
    workspaceName: string,
    userId: string,
    teamMemberId: string,
  ) {
    const [issues, projects] = await Promise.all([
      this.issueService.findAll(workspaceId, userId, {
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 400,
      }),
      this.prisma.project.findMany({
        where: {
          workspaceId,
        },
        select: projectSignalSelect,
      }),
    ]);

    const projectMap = new Map<string, ProjectSignalRecord>();
    for (const project of projects) {
      projectMap.set(project.id, project);
    }

    const signals: InboxSignalDraft[] = [];

    for (const issue of issues) {
      const project = issue.projectId ? projectMap.get(issue.projectId) || null : null;

      const reviewSignal = this.buildReviewSignal(issue, workspaceName, userId);
      if (reviewSignal) {
        signals.push(reviewSignal);
      }

      const handoffSignal = this.buildHandoffSignal(issue, workspaceName, userId);
      if (handoffSignal) {
        signals.push(handoffSignal);
      }

      const blockedSignal = this.buildBlockedSignal(
        issue,
        workspaceName,
        project,
        userId,
        teamMemberId,
      );
      if (blockedSignal) {
        signals.push(blockedSignal);
      }

      const assignedSignal = this.buildAssignmentSignal(
        issue,
        workspaceName,
        userId,
        teamMemberId,
      );
      if (assignedSignal) {
        signals.push(assignedSignal);
      }

      const deadlineSignal = this.buildDeadlineSignal(
        issue,
        workspaceName,
        userId,
        teamMemberId,
      );
      if (deadlineSignal) {
        signals.push(deadlineSignal);
      }
    }

    for (const project of projects) {
      const riskSignal = this.buildProjectRiskSignal(project, userId);
      if (riskSignal) {
        signals.push(riskSignal);
      }
    }

    return signals;
  }

  private async syncUserInboxState(workspaceId: string, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const now = new Date();
    const signals = await this.collectSignalsForUser(
      workspaceId,
      workspace.name,
      userId,
      teamMemberId,
    );
    const activeKeys = new Set(signals.map((signal) => signal.dedupeKey));

    const existingItems = await this.prisma.inboxItem.findMany({
      where: {
        workspaceId,
        targetUserId: userId,
      },
    });

    const existingByDedupeKey = new Map<string, InboxItemRecord>();
    for (const item of existingItems) {
      existingByDedupeKey.set(item.dedupeKey, item);
    }

    await this.prisma.$transaction(async (tx) => {
      for (const signal of signals) {
        const existing = existingByDedupeKey.get(signal.dedupeKey);
        const baseData = {
          type: signal.type,
          bucket: signal.bucket,
          sourceType: signal.sourceType,
          sourceId: signal.sourceId,
          projectId: signal.projectId,
          projectName: signal.projectName,
          issueId: signal.issueId,
          issueKey: signal.issueKey,
          workflowRunId: signal.workflowRunId,
          docId: signal.docId,
          actorUserId: signal.actorUserId,
          title: signal.title,
          summary: signal.summary,
          priority: signal.priority,
          requiresAction: signal.requiresAction,
          actionLabel: signal.actionLabel,
          occurredAt: signal.occurredAt,
          metadata: signal.metadata as Prisma.InputJsonValue,
        };

        if (!existing) {
          await tx.inboxItem.create({
            data: {
              workspaceId,
              targetUserId: userId,
              dedupeKey: signal.dedupeKey,
              status: 'unread',
              ...baseData,
            },
          });
          continue;
        }

        const shouldReopen =
          (existing.status === 'done' || existing.status === 'dismissed') &&
          signal.occurredAt.getTime() > existing.occurredAt.getTime();
        const expiredSnooze =
          existing.status === 'snoozed' &&
          existing.snoozedUntil !== null &&
          existing.snoozedUntil.getTime() <= now.getTime();

        await tx.inboxItem.update({
          where: { id: existing.id },
          data: {
            ...baseData,
            ...(expiredSnooze
              ? {
                  status: 'unread',
                  snoozedUntil: null,
                  readAt: null,
                }
              : {}),
            ...(shouldReopen
              ? {
                  status: 'unread',
                  readAt: null,
                  doneAt: null,
                  dismissedAt: null,
                  snoozedUntil: null,
                }
              : {}),
          },
        });
      }

      const staleIds = existingItems
        .filter(
          (item) =>
            !activeKeys.has(item.dedupeKey) &&
            (item.status === 'unread' ||
              item.status === 'seen' ||
              item.status === 'snoozed'),
        )
        .map((item) => item.id);

      if (staleIds.length > 0) {
        await tx.inboxItem.updateMany({
          where: {
            id: {
              in: staleIds,
            },
          },
          data: {
            status: 'done',
            doneAt: now,
            snoozedUntil: null,
          },
        });
      }
    });
  }

  private async getVisibleInboxItems(workspaceId: string, userId: string) {
    await this.syncUserInboxState(workspaceId, userId);

    const records = await this.prisma.inboxItem.findMany({
      where: {
        workspaceId,
        targetUserId: userId,
      },
    });

    const items = records.map((record) => this.mapRecord(record));
    const activeItems = items.filter(
      (item) => item.status === 'unread' || item.status === 'seen',
    );

    return {
      all: items,
      active: this.sortFeedItems(activeItems),
    };
  }

  private async findUserItemOrThrow(
    workspaceId: string,
    userId: string,
    itemId: string,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const item = await this.prisma.inboxItem.findFirst({
      where: {
        id: itemId,
        workspaceId,
        targetUserId: userId,
      },
    });

    if (!item) {
      throw new NotFoundException(`Inbox item ${itemId} 不存在`);
    }

    return item;
  }

  async getInbox(
    workspaceId: string,
    userId: string,
    query: QueryInboxDto,
  ): Promise<InboxFeedResponse> {
    const { all, active } = await this.getVisibleInboxItems(workspaceId, userId);
    const useStatusRecords =
      query.status &&
      query.status !== 'unread' &&
      query.status !== 'seen';

    const sourceItems = useStatusRecords
      ? this.sortFeedItems(
          (
            await this.prisma.inboxItem.findMany({
              where: {
                workspaceId,
                targetUserId: userId,
                status: query.status,
              },
            })
          ).map((record) => this.mapRecord(record)),
        )
      : active;
    const filteredItems = this.filterFeedItems(sourceItems, query);

    const limit = query.limit ?? 50;
    const startIndex = query.cursor
      ? Math.max(
          filteredItems.findIndex((item) => item.id === query.cursor) + 1,
          0,
        )
      : 0;
    const pagedItems = filteredItems.slice(startIndex, startIndex + limit);
    const nextCursor =
      filteredItems.length > startIndex + limit
        ? pagedItems[pagedItems.length - 1]?.id || null
        : null;

    return {
      workspaceId,
      generatedAt: new Date().toISOString(),
      summary: this.buildSummary(active, all),
      items: pagedItems,
      nextCursor,
    };
  }

  async getInboxSummary(
    workspaceId: string,
    userId: string,
  ): Promise<InboxSummary> {
    const { all, active } = await this.getVisibleInboxItems(workspaceId, userId);
    return this.buildSummary(active, all);
  }

  async markSeen(workspaceId: string, userId: string, itemId: string) {
    const item = await this.findUserItemOrThrow(workspaceId, userId, itemId);

    const updated = await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: item.status === 'unread' ? 'seen' : item.status,
        readAt: item.readAt || new Date(),
      },
    });

    return this.mapRecord(updated);
  }

  async markUnread(workspaceId: string, userId: string, itemId: string) {
    const item = await this.findUserItemOrThrow(workspaceId, userId, itemId);

    const updated = await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: 'unread',
        readAt: null,
      },
    });

    return this.mapRecord(updated);
  }

  async markDone(workspaceId: string, userId: string, itemId: string) {
    const item = await this.findUserItemOrThrow(workspaceId, userId, itemId);

    const updated = await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: 'done',
        doneAt: new Date(),
        snoozedUntil: null,
      },
    });

    return this.mapRecord(updated);
  }

  async dismiss(workspaceId: string, userId: string, itemId: string) {
    const item = await this.findUserItemOrThrow(workspaceId, userId, itemId);

    const updated = await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: 'dismissed',
        dismissedAt: new Date(),
        snoozedUntil: null,
      },
    });

    return this.mapRecord(updated);
  }

  async snooze(
    workspaceId: string,
    userId: string,
    itemId: string,
    dto: SnoozeInboxItemDto,
  ) {
    const item = await this.findUserItemOrThrow(workspaceId, userId, itemId);
    const snoozedUntil = dto.until
      ? new Date(dto.until)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const updated = await this.prisma.inboxItem.update({
      where: { id: item.id },
      data: {
        status: 'snoozed',
        snoozedUntil,
      },
    });

    return this.mapRecord(updated);
  }

  async clearItems(workspaceId: string, userId: string, itemIds: string[]) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const items = await this.prisma.inboxItem.findMany({
      where: {
        id: {
          in: itemIds,
        },
        workspaceId,
        targetUserId: userId,
      },
      select: {
        id: true,
      },
    });

    const validIds = items.map((item) => item.id);

    if (validIds.length === 0) {
      return { updatedCount: 0 };
    }

    const result = await this.prisma.inboxItem.updateMany({
      where: {
        id: {
          in: validIds,
        },
      },
      data: {
        status: 'done',
        doneAt: new Date(),
        snoozedUntil: null,
      },
    });

    return { updatedCount: result.count };
  }

  async getMyWorkInboxSignals(
    workspaceId: string,
    userId: string,
  ): Promise<MyWorkInboxSignal[]> {
    const { active } = await this.getVisibleInboxItems(workspaceId, userId);

    return active.slice(0, 3).map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      projectName: item.projectName,
      actionLabel: item.actionLabel,
      priority: item.priority,
      occurredAt: item.occurredAt,
      requiresAction: item.requiresAction,
    }));
  }
}
