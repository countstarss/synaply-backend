import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  IssuePriority,
  IssueStateCategory,
  IssueStatus,
  IssueType,
  WorkspaceType,
} from '../../prisma/generated/prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';
import { IssueService } from '../issue/issue.service';

interface WorkspaceWorkflowRun {
  templateId?: string | null;
  templateVersion?: string | null;
  runStatus:
    | 'ACTIVE'
    | 'BLOCKED'
    | 'WAITING_REVIEW'
    | 'HANDOFF_PENDING'
    | 'DONE';
  currentActionType:
    | 'execution'
    | 'blocked'
    | 'review'
    | 'handoff'
    | 'done';
  currentStepId?: string | null;
  currentStepIndex?: number | null;
  currentStepStatus?: IssueStatus | null;
  currentStepName?: string | null;
  currentAssigneeUserId?: string | null;
  currentAssigneeName?: string | null;
  totalSteps?: number | null;
  lastEventType?: string | null;
  blockedReason?: string | null;
  targetUserId?: string | null;
  targetName?: string | null;
}

type WorkspaceIssue = Awaited<ReturnType<IssueService['findAll']>>[number] & {
  workflowRun?: WorkspaceWorkflowRun | null;
};

type MyWorkSourceType = 'issue' | 'workflow';
type MyWorkActionType =
  | 'todo'
  | 'execution'
  | 'review'
  | 'handoff'
  | 'blocked'
  | 'done';

export interface MyWorkItem {
  id: string;
  sourceType: MyWorkSourceType;
  sourceId: string;
  issueId: string;
  issueKey: string | null;
  title: string;
  projectId: string | null;
  projectName: string | null;
  workflowId: string | null;
  workflowRunId: string | null;
  currentActionType: MyWorkActionType;
  currentActionLabel: string;
  currentStepName: string | null;
  status: string | null;
  statusLabel: string;
  priority: IssuePriority | null;
  dueAt: string | null;
  updatedAt: string;
  blockedReason: string | null;
  targetUserId: string | null;
  targetName: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  isOverdue: boolean;
  needsAttention: boolean;
}

export interface MyWorkResponse {
  workspaceId: string;
  generatedAt: string;
  counts: {
    total: number;
    todayFocus: number;
    waitingForMe: number;
    inProgress: number;
    blocked: number;
    completedToday: number;
    attention: number;
  };
  todayFocus: MyWorkItem[];
  waitingForMe: MyWorkItem[];
  inProgress: MyWorkItem[];
  blocked: MyWorkItem[];
  completedToday: MyWorkItem[];
  inboxSignals: [];
}

const PRIORITY_WEIGHT: Record<IssuePriority, number> = {
  [IssuePriority.LOW]: 1,
  [IssuePriority.NORMAL]: 2,
  [IssuePriority.HIGH]: 3,
  [IssuePriority.URGENT]: 4,
};

function getStartOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getEndOfDay(value: Date) {
  const endOfDay = getStartOfDay(value);
  endOfDay.setDate(endOfDay.getDate() + 1);
  endOfDay.setMilliseconds(-1);
  return endOfDay;
}

function getDayDistance(from: Date, to: Date) {
  return Math.floor(
    (getStartOfDay(to).getTime() - getStartOfDay(from).getTime()) /
      (24 * 60 * 60 * 1000),
  );
}

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly issueService: IssueService,
  ) {}

  private isWorkflowIssue(issue: WorkspaceIssue) {
    return Boolean(
      issue.issueType === IssueType.WORKFLOW ||
        issue.workflowId ||
        issue.workflowSnapshot ||
        issue.workflowRun,
    );
  }

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

  private isWaitingForUser(
    issue: WorkspaceIssue,
    userId: string,
    teamMemberId: string,
  ) {
    if (
      issue.workflowRun?.targetUserId === userId &&
      (issue.workflowRun.runStatus === 'WAITING_REVIEW' ||
        issue.workflowRun.runStatus === 'HANDOFF_PENDING')
    ) {
      return true;
    }

    if (!this.isAssignedToUser(issue, userId, teamMemberId)) {
      return false;
    }

    if (this.isCompleted(issue) || this.isBlocked(issue)) {
      return false;
    }

    const stateCategory = issue.state?.category;

    if (stateCategory === IssueStateCategory.IN_PROGRESS) {
      return false;
    }

    if (
      issue.currentStepStatus === IssueStatus.IN_PROGRESS ||
      issue.currentStepStatus === IssueStatus.AMOST_DONE
    ) {
      return false;
    }

    return true;
  }

  private isInProgressForUser(
    issue: WorkspaceIssue,
    userId: string,
    teamMemberId: string,
  ) {
    if (!this.isAssignedToUser(issue, userId, teamMemberId)) {
      return false;
    }

    if (this.isCompleted(issue) || this.isBlocked(issue)) {
      return false;
    }

    if (
      issue.workflowRun?.currentAssigneeUserId === userId &&
      issue.workflowRun.currentActionType === 'execution'
    ) {
      return true;
    }

    return (
      issue.currentStepStatus === IssueStatus.IN_PROGRESS ||
      issue.currentStepStatus === IssueStatus.AMOST_DONE ||
      issue.state?.category === IssueStateCategory.IN_PROGRESS
    );
  }

  private isRelevantToUser(
    issue: WorkspaceIssue,
    userId: string,
    teamMemberId: string,
  ) {
    return (
      this.isAssignedToUser(issue, userId, teamMemberId) ||
      this.isWaitingForUser(issue, userId, teamMemberId)
    );
  }

  private getStatusLabel(issue: WorkspaceIssue) {
    if (issue.workflowRun?.runStatus === 'DONE' || this.isCompleted(issue)) {
      return '已完成';
    }

    if (issue.workflowRun?.runStatus === 'BLOCKED' || this.isBlocked(issue)) {
      return '已阻塞';
    }

    switch (issue.currentStepStatus) {
      case IssueStatus.IN_PROGRESS:
        return '执行中';
      case IssueStatus.AMOST_DONE:
        return '接近完成';
      case IssueStatus.DONE:
        return '已完成';
      case IssueStatus.BLOCKED:
        return '已阻塞';
      default:
        break;
    }

    switch (issue.state?.category) {
      case IssueStateCategory.IN_PROGRESS:
        return '进行中';
      case IssueStateCategory.DONE:
        return '已完成';
      case IssueStateCategory.BACKLOG:
        return 'Backlog';
      case IssueStateCategory.CANCELED:
        return '已取消';
      case IssueStateCategory.TODO:
      default:
        return issue.state?.name || '待处理';
    }
  }

  private getActionMeta(
    issue: WorkspaceIssue,
    userId: string,
    teamMemberId: string,
  ): Pick<MyWorkItem, 'currentActionType' | 'currentActionLabel' | 'needsAttention'> {
    if (
      issue.workflowRun?.runStatus === 'WAITING_REVIEW' &&
      issue.workflowRun.targetUserId === userId
    ) {
      return {
        currentActionType: 'review',
        currentActionLabel: '待你 Review',
        needsAttention: true,
      };
    }

    if (
      issue.workflowRun?.runStatus === 'HANDOFF_PENDING' &&
      issue.workflowRun.targetUserId === userId
    ) {
      return {
        currentActionType: 'handoff',
        currentActionLabel: '待你接手',
        needsAttention: true,
      };
    }

    if (this.isBlocked(issue)) {
      return {
        currentActionType: 'blocked',
        currentActionLabel: '阻塞待解',
        needsAttention: true,
      };
    }

    if (this.isCompleted(issue)) {
      return {
        currentActionType: 'done',
        currentActionLabel: '今日已推进',
        needsAttention: false,
      };
    }

    if (this.isInProgressForUser(issue, userId, teamMemberId)) {
      return {
        currentActionType: 'execution',
        currentActionLabel: '执行中',
        needsAttention: false,
      };
    }

    return {
      currentActionType: 'todo',
      currentActionLabel: '待你处理',
      needsAttention: true,
    };
  }

  private getPrimaryAssignee(issue: WorkspaceIssue) {
    const workflowAssigneeName =
      issue.workflowRun?.currentAssigneeName?.trim() || null;
    const workflowAssigneeUserId = issue.workflowRun?.currentAssigneeUserId || null;

    if (workflowAssigneeName || workflowAssigneeUserId) {
      return {
        assigneeName: workflowAssigneeName,
        assigneeUserId: workflowAssigneeUserId,
      };
    }

    const assignee = issue.assignees?.[0]?.member?.user;

    return {
      assigneeName:
        assignee?.name?.trim() ||
        assignee?.email?.split('@')[0] ||
        null,
      assigneeUserId: assignee?.id || null,
    };
  }

  private buildMyWorkItem(
    issue: WorkspaceIssue,
    workspaceName: string,
    userId: string,
    teamMemberId: string,
  ): MyWorkItem {
    const dueAt = issue.dueDate ? new Date(issue.dueDate) : null;
    const now = new Date();
    const actionMeta = this.getActionMeta(issue, userId, teamMemberId);
    const assignee = this.getPrimaryAssignee(issue);

    return {
      id: issue.id,
      sourceType: this.isWorkflowIssue(issue) ? 'workflow' : 'issue',
      sourceId: issue.id,
      issueId: issue.id,
      issueKey: issue.key || null,
      title: issue.title,
      projectId: issue.projectId || null,
      projectName: issue.project?.name || workspaceName,
      workflowId: issue.workflowId || null,
      workflowRunId: this.isWorkflowIssue(issue) ? issue.id : null,
      currentActionType: actionMeta.currentActionType,
      currentActionLabel: actionMeta.currentActionLabel,
      currentStepName: issue.workflowRun?.currentStepName || null,
      status: issue.currentStepStatus || issue.state?.category || null,
      statusLabel: this.getStatusLabel(issue),
      priority: issue.priority || null,
      dueAt: dueAt?.toISOString() || null,
      updatedAt: issue.updatedAt.toISOString(),
      blockedReason: issue.workflowRun?.blockedReason || null,
      targetUserId: issue.workflowRun?.targetUserId || null,
      targetName: issue.workflowRun?.targetName || null,
      assigneeUserId: assignee.assigneeUserId,
      assigneeName: assignee.assigneeName,
      isOverdue: Boolean(dueAt && dueAt.getTime() < now.getTime()),
      needsAttention: actionMeta.needsAttention,
    };
  }

  private getFocusScore(item: MyWorkItem) {
    let score = PRIORITY_WEIGHT[item.priority || IssuePriority.NORMAL] * 10;

    if (item.currentActionType === 'review') {
      score += 36;
    } else if (item.currentActionType === 'handoff') {
      score += 32;
    } else if (item.currentActionType === 'blocked') {
      score += 28;
    } else if (item.currentActionType === 'execution') {
      score += 18;
    } else if (item.currentActionType === 'todo') {
      score += 16;
    }

    if (item.isOverdue) {
      score += 24;
    } else if (item.dueAt) {
      const dayDistance = getDayDistance(new Date(), new Date(item.dueAt));

      if (dayDistance <= 1) {
        score += 12;
      } else if (dayDistance <= 3) {
        score += 6;
      }
    }

    if (item.needsAttention) {
      score += 8;
    }

    return score;
  }

  private sortItems(items: MyWorkItem[]) {
    return [...items].sort((left, right) => {
      const scoreDelta = this.getFocusScore(right) - this.getFocusScore(left);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      if (left.dueAt && right.dueAt) {
        return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
      }

      if (left.dueAt) {
        return -1;
      }

      if (right.dueAt) {
        return 1;
      }

      return (
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  }

  /**
   * MARK: - 获取用户所有工作空间
   * @description
   * 思考过程:
   * 1. 目标: 获取当前用户所属的所有工作空间，包括个人空间和其作为成员的团队空间。
   * 2. 策略: 分两步查询。
   *    a. 查询 `workspace` 表，获取 `userId` 匹配且 `type` 为 `PERSONAL` 的工作空间。
   *    b. 查询 `teamMember` 表，获取 `userId` 匹配的团队成员关系，并通过 `include` 加载关联的 `team` 和 `workspace`。
   * 3. 合并: 将两部分结果合并，并过滤掉可能为空的团队工作空间（因为 `team.workspace` 可能是可选的）。
   * @param userId 用户 ID
   * @returns 工作空间列表
   */
  async getUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        OR: [
          {
            userId,
            type: WorkspaceType.PERSONAL,
          },
          {
            team: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        ],
      },
      include: {
        user: true,
        team: {
          include: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * MARK: - 根据 ID 获取工作空间详情
   * @description
   * 思考过程:
   * 1. 目标: 根据工作空间 ID 获取其详细信息，包括关联的用户（如果是个人空间）或团队（如果是团队空间）。
   * 2. 策略: 使用 `findUnique` 查询 `workspace`，并通过 `include` 加载 `user` 和 `team` 关系。
   * 3. 考虑: 如果工作空间不存在，Prisma 会返回 `null`，由调用方处理 `NotFoundException`。
   * @param workspaceId 工作空间 ID
   * @returns 工作空间对象
   */
  async getWorkspaceById(workspaceId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        user: true,
        team: {
          include: {
            members: {
              select: {
                id: true,
                userId: true,
                role: true,
              },
            },
          },
        },
      }, // 包含关联的用户或团队信息
    });
  }

  /**
   * MARK: - 获取用户所有工作空间 (替代方案)
   * @description
   * 思考过程:
   * 1. 目标: 提供另一种获取用户所有工作空间的方法，通过一个更复杂的 Prisma 查询来一次性完成。
   * 2. 策略: 使用 `OR` 条件，查询 `workspace` 表，匹配 `userId` 或通过 `team` 关系匹配 `team.members.some.userId`。
   * 3. 优点: 查询次数少。
   * 4. 缺点: 查询逻辑可能更复杂，且可能无法直接获取到 `team` 或 `user` 的详细信息，需要额外 `include`。
   * @param userId 用户 ID
   * @returns 工作空间列表
   */
  async findUserWorkspaces(userId: string) {
    return this.prisma.workspace.findMany({
      where: {
        OR: [
          { userId },
          {
            team: {
              members: {
                some: { userId },
              },
            },
          },
        ],
      },
    });
  }

  async getMyWork(workspaceId: string, userId: string): Promise<MyWorkResponse> {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const issues = await this.issueService.findAll(workspaceId, userId, {
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: 200,
    });

    const now = new Date();
    const startOfToday = getStartOfDay(now);
    const endOfToday = getEndOfDay(now);
    const workspaceName = workspace.name;

    const relevantIssues = issues.filter((issue) =>
      this.isRelevantToUser(issue, userId, teamMemberId),
    );

    const waitingForMe = this.sortItems(
      relevantIssues
        .filter((issue) => this.isWaitingForUser(issue, userId, teamMemberId))
        .map((issue) =>
          this.buildMyWorkItem(issue, workspaceName, userId, teamMemberId),
        ),
    );

    const inProgress = this.sortItems(
      relevantIssues
        .filter((issue) => this.isInProgressForUser(issue, userId, teamMemberId))
        .map((issue) =>
          this.buildMyWorkItem(issue, workspaceName, userId, teamMemberId),
        ),
    );

    const blocked = this.sortItems(
      relevantIssues
        .filter((issue) => this.isBlocked(issue))
        .map((issue) =>
          this.buildMyWorkItem(issue, workspaceName, userId, teamMemberId),
        ),
    );

    const completedToday = this.sortItems(
      relevantIssues
        .filter((issue) => {
          if (!this.isCompleted(issue)) {
            return false;
          }

          const updatedAt = new Date(issue.updatedAt).getTime();
          return (
            updatedAt >= startOfToday.getTime() &&
            updatedAt <= endOfToday.getTime()
          );
        })
        .map((issue) =>
          this.buildMyWorkItem(issue, workspaceName, userId, teamMemberId),
        ),
    );

    const focusCandidates = this.sortItems([
      ...waitingForMe,
      ...inProgress,
      ...blocked,
    ]);

    const seenFocusIds = new Set<string>();
    const todayFocus = focusCandidates.filter((item) => {
      if (seenFocusIds.has(item.id)) {
        return false;
      }

      seenFocusIds.add(item.id);
      return seenFocusIds.size <= 5;
    });

    return {
      workspaceId,
      generatedAt: now.toISOString(),
      counts: {
        total: waitingForMe.length + inProgress.length + blocked.length,
        todayFocus: todayFocus.length,
        waitingForMe: waitingForMe.length,
        inProgress: inProgress.length,
        blocked: blocked.length,
        completedToday: completedToday.length,
        attention: waitingForMe.length + blocked.length,
      },
      todayFocus,
      waitingForMe,
      inProgress,
      blocked,
      completedToday,
      inboxSignals: [],
    };
  }
}
