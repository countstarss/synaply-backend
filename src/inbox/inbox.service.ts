import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DocKind,
  DocType,
  Prisma,
  InboxItem as InboxItemRecord,
  IssuePriority,
  IssueStateCategory,
  IssueStatus,
  Role,
  VisibilityType,
  WorkspaceType,
} from '../../prisma/generated/prisma/client';
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

const docSignalSelect = {
  id: true,
  title: true,
  kind: true,
  visibility: true,
  projectId: true,
  issueId: true,
  workflowId: true,
  creatorMemberId: true,
  ownerMemberId: true,
  lastEditedAt: true,
} satisfies Prisma.DocSelect;

type DocSignalRecord = Prisma.DocGetPayload<{
  select: typeof docSignalSelect;
}>;

const workflowSignalSelect = {
  id: true,
  name: true,
} satisfies Prisma.WorkflowSelect;

type WorkflowSignalRecord = Prisma.WorkflowGetPayload<{
  select: typeof workflowSignalSelect;
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
  'doc.review.ready': 94,
  'doc.handoff.ready': 93,
  'workflow.blocked': 92,
  'deadline.soon': 88,
  'issue.assigned': 84,
  'doc.release.updated': 83,
  'issue.canceled': 82,
  'project.risk.flagged': 80,
  'doc.decision.updated': 78,
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
        issue.state?.category === IssueStateCategory.DONE ||
        issue.state?.category === IssueStateCategory.CANCELED,
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

    if (
      issue.assignees?.some((assignee) => assignee.memberId === teamMemberId)
    ) {
      return true;
    }

    return issue.workflowRun?.currentAssigneeUserId === userId;
  }

  private canUserSeeDoc(
    doc: DocSignalRecord,
    workspaceType: WorkspaceType,
    teamMemberId: string,
    workspaceRole: Role,
  ) {
    if (workspaceType === WorkspaceType.PERSONAL) {
      return true;
    }

    if (
      doc.creatorMemberId === teamMemberId ||
      doc.ownerMemberId === teamMemberId
    ) {
      return true;
    }

    if (workspaceRole === Role.OWNER || workspaceRole === Role.ADMIN) {
      return true;
    }

    return doc.visibility !== VisibilityType.PRIVATE;
  }

  private isProjectOwner(project: ProjectSignalRecord | null, userId: string) {
    return project?.owner?.user?.id === userId;
  }

  private getDocSignalContext(
    workspaceType: WorkspaceType,
    visibility: VisibilityType,
  ) {
    if (workspaceType === WorkspaceType.PERSONAL) {
      return 'personal';
    }

    return visibility === VisibilityType.PRIVATE ? 'team-personal' : 'team';
  }

  private isIssueContextRelevant(
    issue: WorkspaceIssue | null,
    project: ProjectSignalRecord | null,
    userId: string,
    teamMemberId: string,
  ) {
    if (!issue) {
      return false;
    }

    return (
      this.isAssignedToUser(issue, userId, teamMemberId) ||
      issue.creatorId === userId ||
      issue.creatorMemberId === teamMemberId ||
      this.isProjectOwner(project, userId)
    );
  }

  private isProjectContextRelevant(
    project: ProjectSignalRecord | null,
    projectIssues: WorkspaceIssue[],
    userId: string,
    teamMemberId: string,
  ) {
    if (this.isProjectOwner(project, userId)) {
      return true;
    }

    return projectIssues.some((issue) =>
      this.isIssueContextRelevant(issue, project, userId, teamMemberId),
    );
  }

  private buildDigestKindCounts(docs: DocSignalRecord[]) {
    const counts = new Map<DocKind, number>();

    for (const doc of docs) {
      counts.set(doc.kind, (counts.get(doc.kind) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([kind, count]) => ({
      kind,
      count,
    }));
  }

  private getDigestPriority(
    docs: DocSignalRecord[],
    project: ProjectSignalRecord | null,
  ): InboxItemPriority {
    const kinds = new Set(docs.map((doc) => doc.kind));

    if (
      kinds.has(DocKind.RELEASE_CHECKLIST) &&
      this.isCriticalRisk(project?.riskLevel)
    ) {
      return 'urgent';
    }

    if (
      kinds.has(DocKind.REVIEW_PACKET) ||
      kinds.has(DocKind.HANDOFF_PACKET) ||
      kinds.has(DocKind.RELEASE_CHECKLIST)
    ) {
      return 'high';
    }

    if (
      kinds.has(DocKind.PROJECT_BRIEF) ||
      kinds.has(DocKind.DECISION_LOG)
    ) {
      return 'normal';
    }

    return 'low';
  }

  private buildDigestSignals(
    docs: DocSignalRecord[],
    workspaceName: string,
    workspaceType: WorkspaceType,
    workspaceRole: Role,
    userId: string,
    teamMemberId: string,
    issueMap: Map<string, WorkspaceIssue>,
    issuesByWorkflowId: Map<string, WorkspaceIssue[]>,
    issuesByProjectId: Map<string, WorkspaceIssue[]>,
    projectMap: Map<string, ProjectSignalRecord>,
    workflowMap: Map<string, WorkflowSignalRecord>,
  ): InboxSignalDraft[] {
    const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
    const recentThreshold = Date.now() - recentWindowMs;
    const groupedDocs = new Map<string, DocSignalRecord[]>();

    for (const doc of docs) {
      if (
        !this.canUserSeeDoc(doc, workspaceType, teamMemberId, workspaceRole) ||
        doc.creatorMemberId === teamMemberId ||
        doc.kind === DocKind.GENERAL ||
        doc.lastEditedAt.getTime() < recentThreshold
      ) {
        continue;
      }

      const groupKey = doc.issueId
        ? `issue:${doc.issueId}`
        : doc.workflowId
          ? `workflow:${doc.workflowId}`
          : doc.projectId
            ? `project:${doc.projectId}`
            : null;

      if (!groupKey) {
        continue;
      }

      const bucket = groupedDocs.get(groupKey) ?? [];
      bucket.push(doc);
      groupedDocs.set(groupKey, bucket);
    }

    const signals: InboxSignalDraft[] = [];

    for (const [groupKey, groupDocs] of groupedDocs.entries()) {
      const latestDoc = [...groupDocs].sort(
        (left, right) => right.lastEditedAt.getTime() - left.lastEditedAt.getTime(),
      )[0];

      if (!latestDoc) {
        continue;
      }

      const kindCounts = this.buildDigestKindCounts(groupDocs);
      const shouldCreateDigest =
        groupDocs.length > 1 ||
        kindCounts.length > 1 ||
        kindCounts.some(({ kind }) => kind === DocKind.PROJECT_BRIEF);

      if (!shouldCreateDigest) {
        continue;
      }

      const latestDocContext = this.getDocSignalContext(
        workspaceType,
        latestDoc.visibility,
      );

      if (groupKey.startsWith('issue:')) {
        const issueId = groupKey.slice('issue:'.length);
        const issue = issueMap.get(issueId) ?? null;

        if (!issue) {
          continue;
        }

        const project = issue.projectId
          ? projectMap.get(issue.projectId) ?? null
          : null;

        if (
          !this.isIssueContextRelevant(issue, project, userId, teamMemberId) &&
          !this.isProjectOwner(project, userId)
        ) {
          continue;
        }

        const sourceType = getIssueSignalSourceType(issue);
        const projectName = project?.name ?? issue.project?.name ?? workspaceName;

        signals.push({
          dedupeKey: `digest.generated:issue:${issue.id}:${userId}`,
          type: 'digest.generated',
          bucket: 'digest',
          sourceType,
          sourceId: issue.id,
          projectId: project?.id ?? null,
          projectName,
          issueId: issue.id,
          issueKey: issue.key ?? null,
          workflowRunId: sourceType === 'workflow' ? issue.id : null,
          docId: latestDoc.id,
          actorUserId: null,
          title: `Doc digest updated for ${issue.title}`,
          summary: `${groupDocs.length} collaboration docs changed around ${issue.title}.`,
          priority: this.getDigestPriority(groupDocs, project),
          requiresAction: false,
          actionLabel: 'Open latest doc',
          occurredAt: latestDoc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docContext: latestDocContext,
            docKind: latestDoc.kind,
            docTitle: latestDoc.title,
            latestDocTitle: latestDoc.title,
            digestDocCount: groupDocs.length,
            digestKinds: kindCounts,
            digestTargetType: sourceType,
            digestTargetLabel: issue.title,
          },
        });

        continue;
      }

      if (groupKey.startsWith('workflow:')) {
        const workflowId = groupKey.slice('workflow:'.length);
        const workflow = workflowMap.get(workflowId) ?? null;
        const workflowIssues = issuesByWorkflowId.get(workflowId) ?? [];
        const relevantIssue =
          workflowIssues.find((issue) =>
            this.isIssueContextRelevant(
              issue,
              issue.projectId ? projectMap.get(issue.projectId) ?? null : null,
              userId,
              teamMemberId,
            ),
          ) ?? null;
        const project =
          (latestDoc.projectId ? projectMap.get(latestDoc.projectId) ?? null : null) ??
          (relevantIssue?.projectId
            ? projectMap.get(relevantIssue.projectId) ?? null
            : null);

        if (
          !relevantIssue &&
          !this.isProjectContextRelevant(
            project,
            project?.id ? issuesByProjectId.get(project.id) ?? [] : [],
            userId,
            teamMemberId,
          )
        ) {
          continue;
        }

        signals.push({
          dedupeKey: `digest.generated:workflow:${workflowId}:${userId}`,
          type: 'digest.generated',
          bucket: 'digest',
          sourceType: 'workflow',
          sourceId: workflowId,
          projectId: project?.id ?? null,
          projectName: project?.name ?? workspaceName,
          issueId: relevantIssue?.id ?? null,
          issueKey: relevantIssue?.key ?? null,
          workflowRunId: relevantIssue?.id ?? null,
          docId: latestDoc.id,
          actorUserId: null,
          title: `Workflow doc digest updated for ${workflow?.name ?? workspaceName}`,
          summary: `${groupDocs.length} collaboration docs changed in this workflow context.`,
          priority: this.getDigestPriority(groupDocs, project),
          requiresAction: false,
          actionLabel: 'Open latest doc',
          occurredAt: latestDoc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docContext: latestDocContext,
            docKind: latestDoc.kind,
            docTitle: latestDoc.title,
            latestDocTitle: latestDoc.title,
            digestDocCount: groupDocs.length,
            digestKinds: kindCounts,
            digestTargetType: 'workflow',
            digestTargetLabel:
              workflow?.name ?? project?.name ?? relevantIssue?.title ?? workspaceName,
          },
        });

        continue;
      }

      const projectId = groupKey.slice('project:'.length);
      const project = projectMap.get(projectId) ?? null;
      const projectIssues = issuesByProjectId.get(projectId) ?? [];

      if (
        !this.isProjectContextRelevant(project, projectIssues, userId, teamMemberId)
      ) {
        continue;
      }

      const projectName = project?.name ?? workspaceName;

      signals.push({
        dedupeKey: `digest.generated:project:${projectId}:${userId}`,
        type: 'digest.generated',
        bucket: 'digest',
        sourceType: 'project',
        sourceId: projectId,
        projectId,
        projectName,
        issueId: null,
        issueKey: null,
        workflowRunId: null,
        docId: latestDoc.id,
        actorUserId: null,
        title: `Project doc digest updated for ${projectName}`,
        summary: `${groupDocs.length} collaboration docs changed in ${projectName}.`,
        priority: this.getDigestPriority(groupDocs, project),
        requiresAction: false,
        actionLabel: 'Open latest doc',
        occurredAt: latestDoc.lastEditedAt,
        metadata: {
          managedBySync: true,
          docContext: latestDocContext,
          docKind: latestDoc.kind,
          docTitle: latestDoc.title,
          latestDocTitle: latestDoc.title,
          digestDocCount: groupDocs.length,
          digestKinds: kindCounts,
          digestTargetType: 'project',
          digestTargetLabel: projectName,
        },
      });
    }

    return signals;
  }

  private buildDocSignal(
    doc: DocSignalRecord,
    workspaceName: string,
    workspaceType: WorkspaceType,
    workspaceRole: Role,
    userId: string,
    teamMemberId: string,
    issueMap: Map<string, WorkspaceIssue>,
    issuesByWorkflowId: Map<string, WorkspaceIssue[]>,
    projectMap: Map<string, ProjectSignalRecord>,
  ): InboxSignalDraft | null {
    if (
      !this.canUserSeeDoc(doc, workspaceType, teamMemberId, workspaceRole) ||
      doc.creatorMemberId === teamMemberId
    ) {
      return null;
    }

    const directIssue = doc.issueId ? (issueMap.get(doc.issueId) ?? null) : null;
    const workflowIssues = doc.workflowId
      ? (issuesByWorkflowId.get(doc.workflowId) ?? [])
      : [];
    const relevantWorkflowIssue =
      workflowIssues.find((issue) =>
        this.isIssueContextRelevant(
          issue,
          issue.projectId ? projectMap.get(issue.projectId) ?? null : null,
          userId,
          teamMemberId,
        ),
      ) ?? null;
    const issue = directIssue ?? relevantWorkflowIssue;
    const project =
      (doc.projectId ? projectMap.get(doc.projectId) ?? null : null) ??
      (issue?.projectId ? projectMap.get(issue.projectId) ?? null : null);
    const projectName = project?.name ?? issue?.project?.name ?? workspaceName;
    const issueId = issue?.id ?? null;
    const issueKey = issue?.key ?? null;
    const workflowRunId =
      issue && getIssueSignalSourceType(issue) === 'workflow' ? issue.id : null;
    const issueRelevant = this.isIssueContextRelevant(
      issue,
      project,
      userId,
      teamMemberId,
    );
    const docContext = this.getDocSignalContext(workspaceType, doc.visibility);

    switch (doc.kind) {
      case DocKind.DECISION_LOG: {
        if (!issueRelevant && !this.isProjectOwner(project, userId)) {
          return null;
        }

        return {
          dedupeKey: `doc.decision.updated:${doc.id}:${userId}`,
          type: 'doc.decision.updated',
          bucket: 'following',
          sourceType: 'doc',
          sourceId: doc.id,
          projectId: project?.id ?? null,
          projectName,
          issueId,
          issueKey,
          workflowRunId,
          docId: doc.id,
          actorUserId: null,
          title: `Decision updated: ${doc.title}`,
          summary:
            issue?.title != null
              ? `The latest decision now affects ${issue.title}.`
              : `A project decision changed in ${projectName}.`,
          priority: 'normal',
          requiresAction: false,
          actionLabel: 'Open decision log',
          occurredAt: doc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docKind: doc.kind,
            docContext,
            docTitle: doc.title,
          },
        };
      }

      case DocKind.REVIEW_PACKET: {
        if (!issue) {
          return null;
        }

        const isReviewTarget =
          issue.workflowRun?.runStatus === 'WAITING_REVIEW' &&
          issue.workflowRun.targetUserId === userId;

        if (!isReviewTarget && !issueRelevant) {
          return null;
        }

        return {
          dedupeKey: `doc.review.ready:${doc.id}:${userId}`,
          type: 'doc.review.ready',
          bucket: isReviewTarget ? 'needs-response' : 'needs-attention',
          sourceType: 'doc',
          sourceId: doc.id,
          projectId: project?.id ?? null,
          projectName,
          issueId,
          issueKey,
          workflowRunId,
          docId: doc.id,
          actorUserId: null,
          title: `Review packet ready: ${doc.title}`,
          summary: isReviewTarget
            ? `The latest review context is ready for ${issue.title}.`
            : `Review context was updated for ${issue.title}.`,
          priority: isReviewTarget ? 'high' : this.normalizePriority(issue.priority),
          requiresAction: isReviewTarget,
          actionLabel: isReviewTarget ? 'Open review packet' : 'Open review context',
          occurredAt: doc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docKind: doc.kind,
            docContext,
            docTitle: doc.title,
          },
        };
      }

      case DocKind.HANDOFF_PACKET: {
        if (!issue) {
          return null;
        }

        const isHandoffTarget =
          issue.workflowRun?.runStatus === 'HANDOFF_PENDING' &&
          issue.workflowRun.targetUserId === userId;

        if (!isHandoffTarget && !issueRelevant) {
          return null;
        }

        return {
          dedupeKey: `doc.handoff.ready:${doc.id}:${userId}`,
          type: 'doc.handoff.ready',
          bucket: isHandoffTarget ? 'needs-response' : 'needs-attention',
          sourceType: 'doc',
          sourceId: doc.id,
          projectId: project?.id ?? null,
          projectName,
          issueId,
          issueKey,
          workflowRunId,
          docId: doc.id,
          actorUserId: null,
          title: `Handoff packet ready: ${doc.title}`,
          summary: isHandoffTarget
            ? `The handoff context is ready before you take over ${issue.title}.`
            : `Handoff context was updated for ${issue.title}.`,
          priority: isHandoffTarget ? 'high' : this.normalizePriority(issue.priority),
          requiresAction: isHandoffTarget,
          actionLabel: isHandoffTarget
            ? 'Open handoff packet'
            : 'Open handoff context',
          occurredAt: doc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docKind: doc.kind,
            docContext,
            docTitle: doc.title,
          },
        };
      }

      case DocKind.RELEASE_CHECKLIST: {
        if (!issueRelevant && !this.isProjectOwner(project, userId)) {
          return null;
        }

        return {
          dedupeKey: `doc.release.updated:${doc.id}:${userId}`,
          type: 'doc.release.updated',
          bucket: 'needs-attention',
          sourceType: 'doc',
          sourceId: doc.id,
          projectId: project?.id ?? null,
          projectName,
          issueId,
          issueKey,
          workflowRunId,
          docId: doc.id,
          actorUserId: null,
          title: `Release checklist updated: ${doc.title}`,
          summary: `The latest launch readiness notes for ${projectName} were updated.`,
          priority: project?.riskLevel === 'CRITICAL' ? 'urgent' : 'high',
          requiresAction: false,
          actionLabel: 'Open release checklist',
          occurredAt: doc.lastEditedAt,
          metadata: {
            managedBySync: true,
            docKind: doc.kind,
            docContext,
            docTitle: doc.title,
          },
        };
      }

      default:
        return null;
    }
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
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime()
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
      summary: issue.workflowRun?.currentStepName
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
      priority: issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
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
      priority: issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
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
      priority: issue.priority === IssuePriority.URGENT ? 'urgent' : 'high',
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

    if (
      !this.isAssignedToUser(issue, userId, teamMemberId) ||
      this.isCompleted(issue)
    ) {
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
    if (
      project.owner.user?.id !== userId ||
      !this.isHighRisk(project.riskLevel)
    ) {
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
      summary:
        'Review blockers, deadlines, and pending confirmations before momentum slips.',
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
    workspaceType: WorkspaceType,
    workspaceRole: Role,
    userId: string,
    teamMemberId: string,
  ) {
    const recentDocThreshold = new Date(
      Date.now() - 14 * 24 * 60 * 60 * 1000,
    );
    const [issues, projects, docs] = await Promise.all([
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
      this.prisma.doc.findMany({
        where: {
          workspaceId,
          type: DocType.DOCUMENT,
          isDeleted: false,
          isArchived: false,
          kind: {
            not: DocKind.GENERAL,
          },
          lastEditedAt: {
            gte: recentDocThreshold,
          },
        },
        select: docSignalSelect,
      }),
    ]);
    const workflowIds = Array.from(
      new Set(
        docs
          .map((doc) => doc.workflowId)
          .filter((workflowId): workflowId is string => Boolean(workflowId)),
      ),
    );
    const workflows =
      workflowIds.length > 0
        ? await this.prisma.workflow.findMany({
            where: {
              workspaceId,
              id: {
                in: workflowIds,
              },
            },
            select: workflowSignalSelect,
          })
        : [];

    const projectMap = new Map<string, ProjectSignalRecord>();
    for (const project of projects) {
      projectMap.set(project.id, project);
    }

    const workflowMap = new Map<string, WorkflowSignalRecord>();
    for (const workflow of workflows) {
      workflowMap.set(workflow.id, workflow);
    }

    const issueMap = new Map<string, WorkspaceIssue>();
    const issuesByWorkflowId = new Map<string, WorkspaceIssue[]>();
    const issuesByProjectId = new Map<string, WorkspaceIssue[]>();
    for (const issue of issues) {
      issueMap.set(issue.id, issue);

      if (issue.projectId) {
        const projectIssues = issuesByProjectId.get(issue.projectId) ?? [];
        projectIssues.push(issue);
        issuesByProjectId.set(issue.projectId, projectIssues);
      }

      if (!issue.workflowId) {
        continue;
      }

      const workflowIssues = issuesByWorkflowId.get(issue.workflowId) ?? [];
      workflowIssues.push(issue);
      issuesByWorkflowId.set(issue.workflowId, workflowIssues);
    }

    const signals: InboxSignalDraft[] = [];

    for (const issue of issues) {
      const project = issue.projectId
        ? projectMap.get(issue.projectId) || null
        : null;

      const reviewSignal = this.buildReviewSignal(issue, workspaceName, userId);
      if (reviewSignal) {
        signals.push(reviewSignal);
      }

      const handoffSignal = this.buildHandoffSignal(
        issue,
        workspaceName,
        userId,
      );
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

    for (const doc of docs) {
      const docSignal = this.buildDocSignal(
        doc,
        workspaceName,
        workspaceType,
        workspaceRole,
        userId,
        teamMemberId,
        issueMap,
        issuesByWorkflowId,
        projectMap,
      );

      if (docSignal) {
        signals.push(docSignal);
      }
    }

    signals.push(
      ...this.buildDigestSignals(
        docs,
        workspaceName,
        workspaceType,
        workspaceRole,
        userId,
        teamMemberId,
        issueMap,
        issuesByWorkflowId,
        issuesByProjectId,
        projectMap,
        workflowMap,
      ),
    );

    return signals;
  }

  private async syncUserInboxState(workspaceId: string, userId: string) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    const workspaceRole =
      workspace.type === WorkspaceType.PERSONAL
        ? Role.OWNER
        : workspace.team?.members?.[0]?.role ?? Role.MEMBER;

    const now = new Date();
    const signals = await this.collectSignalsForUser(
      workspaceId,
      workspace.name,
      workspace.type,
      workspaceRole,
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
        .filter((item) => {
          const metadata = parseMetadata(item.metadata);

          return (
            metadata?.managedBySync === true &&
            !activeKeys.has(item.dedupeKey) &&
            (item.status === 'unread' ||
              item.status === 'seen' ||
              item.status === 'snoozed')
          );
        })
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
    const { all, active } = await this.getVisibleInboxItems(
      workspaceId,
      userId,
    );
    const useStatusRecords =
      query.status && query.status !== 'unread' && query.status !== 'seen';

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
    const { all, active } = await this.getVisibleInboxItems(
      workspaceId,
      userId,
    );
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
