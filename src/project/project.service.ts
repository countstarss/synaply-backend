import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IssuePriority,
  IssueStateCategory,
  IssueStatus,
  Prisma,
  Role,
  VisibilityType,
} from '../../prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PermissionService } from '../common/services/permission.service';
import { ProjectRiskLevelValue, ProjectStatusValue } from './project.constants';

const projectSummaryIssueSelect = {
  id: true,
  key: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
  dueDate: true,
  priority: true,
  issueType: true,
  workflowId: true,
  directAssigneeId: true,
  currentStepStatus: true,
  currentStepIndex: true,
  totalSteps: true,
  state: {
    select: {
      id: true,
      name: true,
      color: true,
      category: true,
    },
  },
  assignees: {
    select: {
      member: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.IssueSelect;

const projectActivityInclude = {
  actor: {
    include: {
      user: true,
    },
  },
  issue: {
    select: {
      id: true,
      key: true,
      title: true,
    },
  },
} satisfies Prisma.IssueActivityInclude;

const projectWorkflowInclude = {
  creator: {
    include: {
      user: true,
    },
  },
} satisfies Prisma.WorkflowInclude;

type ProjectSummaryIssue = Prisma.IssueGetPayload<{
  select: typeof projectSummaryIssueSelect;
}>;

const ACTIVE_ISSUE_STATE_CATEGORIES = new Set<IssueStateCategory>([
  IssueStateCategory.BACKLOG,
  IssueStateCategory.TODO,
  IssueStateCategory.IN_PROGRESS,
]);

type ProjectReadRecord = {
  id: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: ProjectStatusValue;
  phase: string | null;
  risk_level: ProjectRiskLevelValue;
  workspace_id: string;
  created_at: Date | string;
  updated_at: Date | string;
  creator_id: string;
  owner_member_id: string;
  last_sync_at: Date | string | null;
  visibility: VisibilityType;
  workspace_name: string;
  workspace_type: 'PERSONAL' | 'TEAM';
  owner_id: string | null;
  owner_user_id: string | null;
  owner_role: Role | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_avatar_url: string | null;
};

type ProjectReadModel = {
  id: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: ProjectStatusValue;
  phase: string | null;
  riskLevel: ProjectRiskLevelValue;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  creatorId: string;
  ownerMemberId: string;
  lastSyncAt: string | null;
  visibility: VisibilityType;
  workspace: {
    id: string;
    name: string;
    type: 'PERSONAL' | 'TEAM';
  };
  owner: {
    id: string;
    userId: string;
    role: Role;
    user: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  } | null;
};

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly permissionService: PermissionService,
  ) {}

  async create(
    workspaceId: string,
    createProjectDto: CreateProjectDto,
    userId: string,
  ) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    this.ensureProjectManagementPermission(workspace, userId, '创建');

    const visibility =
      createProjectDto.visibility ??
      (workspace.type === 'TEAM'
        ? VisibilityType.TEAM_READONLY
        : VisibilityType.PRIVATE);

    const ownerMemberId = await this.resolveOwnerMemberId(
      workspaceId,
      createProjectDto.ownerMemberId,
      teamMemberId,
    );

    const projectId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "projects" (
          "id",
          "name",
          "description",
          "brief",
          "status",
          "phase",
          "risk_level",
          "workspace_id",
          "created_at",
          "updated_at",
          "creator_id",
          "owner_member_id",
          "last_sync_at",
          "visibility"
        )
        VALUES (
          ${projectId},
          ${createProjectDto.name},
          ${createProjectDto.description ?? null},
          ${createProjectDto.brief ?? null},
          ${createProjectDto.status ?? ProjectStatusValue.ACTIVE}::"ProjectStatus",
          ${createProjectDto.phase ?? null},
          ${createProjectDto.riskLevel ?? ProjectRiskLevelValue.LOW}::"ProjectRiskLevel",
          ${workspaceId},
          NOW(),
          NOW(),
          ${teamMemberId},
          ${ownerMemberId},
          ${
            createProjectDto.lastSyncAt
              ? new Date(createProjectDto.lastSyncAt)
              : null
          },
          ${visibility}::"VisibilityType"
        )
      `,
    );

    return this.findOne(workspaceId, projectId, userId);
  }

  async findAll(workspaceId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const projects = await this.getProjectRecords(workspaceId);
    const visibleProjects = await Promise.all(
      projects.map(async (project) => {
        const canRead = await this.permissionService.checkResourcePermission(
          userId,
          'project',
          project.id,
          'read',
        );

        return canRead ? project : null;
      }),
    );

    return visibleProjects.filter(
      (project): project is ProjectReadModel => project !== null,
    );
  }

  async findOne(workspaceId: string, projectId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      projectId,
      'read',
    );

    return this.findProjectOrThrow(workspaceId, projectId);
  }

  async findSummary(workspaceId: string, projectId: string, userId: string) {
    const { teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      projectId,
      'read',
    );

    const [project, issues] = await Promise.all([
      this.findProjectOrThrow(workspaceId, projectId),
      this.getAccessibleProjectIssues(workspaceId, projectId, teamMemberId),
    ]);

    const activeIssues = issues.filter((issue) => this.isActiveIssue(issue));
    const [recentActivity, workflows] = await Promise.all([
      this.getProjectActivityInternal(issues.map((issue) => issue.id)),
      this.getProjectWorkflowsInternal(workspaceId, issues),
    ]);
    const metrics = this.buildProjectMetrics(project, issues, workflows.length);
    const blockedIssues = [...activeIssues]
      .filter((issue) => this.isBlockedIssue(issue))
      .sort((left, right) => this.compareIssuesByImportance(left, right))
      .slice(0, 5);
    const keyIssues = [...activeIssues]
      .sort((left, right) => this.compareIssuesByImportance(left, right))
      .slice(0, 6);

    return {
      project,
      metrics,
      issueBreakdown: this.buildIssueBreakdown(issues),
      keyIssues,
      blockedIssues,
      workflows,
      recentActivity,
      attentionItems: this.buildAttentionItems(project, metrics, issues),
    };
  }

  async findActivity(workspaceId: string, projectId: string, userId: string) {
    const { teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      projectId,
      'read',
    );

    await this.findProjectOrThrow(workspaceId, projectId);
    const issues = await this.getAccessibleProjectIssues(
      workspaceId,
      projectId,
      teamMemberId,
    );
    return this.getProjectActivityInternal(issues.map((issue) => issue.id));
  }

  async findWorkflows(workspaceId: string, projectId: string, userId: string) {
    const { teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      projectId,
      'read',
    );

    await this.findProjectOrThrow(workspaceId, projectId);
    const issues = await this.getAccessibleProjectIssues(
      workspaceId,
      projectId,
      teamMemberId,
    );

    return this.getProjectWorkflowsInternal(workspaceId, issues);
  }

  async update(
    workspaceId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ) {
    const { workspace } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    this.ensureProjectManagementPermission(workspace, userId, '更新');
    await this.findProjectOrThrow(workspaceId, projectId);

    const ownerMemberId =
      updateProjectDto.ownerMemberId !== undefined
        ? await this.resolveOwnerMemberId(
            workspaceId,
            updateProjectDto.ownerMemberId,
          )
        : undefined;

    const updates: Prisma.Sql[] = [];

    if (updateProjectDto.name !== undefined) {
      updates.push(Prisma.sql`"name" = ${updateProjectDto.name}`);
    }
    if (updateProjectDto.description !== undefined) {
      updates.push(
        Prisma.sql`"description" = ${updateProjectDto.description ?? null}`,
      );
    }
    if (updateProjectDto.brief !== undefined) {
      updates.push(Prisma.sql`"brief" = ${updateProjectDto.brief ?? null}`);
    }
    if (updateProjectDto.status !== undefined) {
      updates.push(
        Prisma.sql`"status" = ${updateProjectDto.status}::"ProjectStatus"`,
      );
    }
    if (updateProjectDto.phase !== undefined) {
      updates.push(Prisma.sql`"phase" = ${updateProjectDto.phase ?? null}`);
    }
    if (updateProjectDto.riskLevel !== undefined) {
      updates.push(
        Prisma.sql`"risk_level" = ${updateProjectDto.riskLevel}::"ProjectRiskLevel"`,
      );
    }
    if (updateProjectDto.visibility !== undefined) {
      updates.push(
        Prisma.sql`"visibility" = ${updateProjectDto.visibility}::"VisibilityType"`,
      );
    }
    if (ownerMemberId !== undefined) {
      updates.push(Prisma.sql`"owner_member_id" = ${ownerMemberId}`);
    }
    if (updateProjectDto.lastSyncAt !== undefined) {
      updates.push(
        Prisma.sql`"last_sync_at" = ${new Date(updateProjectDto.lastSyncAt)}`,
      );
    }

    if (updates.length === 0) {
      return this.findOne(workspaceId, projectId, userId);
    }

    updates.push(Prisma.sql`"updated_at" = NOW()`);

    await this.prisma.$executeRaw(
      Prisma.sql`
        UPDATE "projects"
        SET ${Prisma.join(updates, ', ')}
        WHERE "id" = ${projectId}
          AND "workspace_id" = ${workspaceId}
      `,
    );

    return this.findOne(workspaceId, projectId, userId);
  }

  async remove(workspaceId: string, projectId: string, userId: string) {
    const { workspace } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    this.ensureProjectManagementPermission(workspace, userId, '删除');
    const project = await this.findProjectOrThrow(workspaceId, projectId);

    return this.prisma.$transaction(async (tx) => {
      const projectIssues = await tx.issue.findMany({
        where: { projectId },
        select: { id: true },
      });

      const issueIds = projectIssues.map((issue) => issue.id);

      if (issueIds.length > 0) {
        await tx.comment.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issueActivity.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issueStepRecord.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issue.deleteMany({
          where: {
            id: {
              in: issueIds,
            },
          },
        });
      }

      await tx.$executeRaw(
        Prisma.sql`
          DELETE FROM "docs"
          WHERE "project_id" = ${projectId}
        `,
      );

      await tx.project.delete({
        where: { id: projectId },
      });

      return {
        ...project,
        deletedIssueCount: issueIds.length,
      };
    });
  }

  private async getProjectActivityInternal(issueIds: string[]) {
    if (issueIds.length === 0) {
      return [];
    }

    return this.prisma.issueActivity.findMany({
      where: {
        issueId: {
          in: issueIds,
        },
      },
      include: projectActivityInclude,
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
  }

  private async getAccessibleProjectIssues(
    workspaceId: string,
    projectId: string,
    teamMemberId: string,
  ) {
    return this.prisma.issue.findMany({
      where: this.buildAccessibleProjectIssueWhere(
        workspaceId,
        projectId,
        teamMemberId,
      ),
      select: projectSummaryIssueSelect,
    });
  }

  private buildAccessibleProjectIssueWhere(
    workspaceId: string,
    projectId: string,
    teamMemberId: string,
  ): Prisma.IssueWhereInput {
    return {
      workspaceId,
      projectId,
      OR: [
        {
          visibility: {
            not: VisibilityType.PRIVATE,
          },
        },
        {
          creatorMemberId: teamMemberId,
        },
      ],
    };
  }

  private async getProjectWorkflowsInternal(
    workspaceId: string,
    issues: ProjectSummaryIssue[],
  ) {
    const workflowIds = Array.from(
      new Set(
        issues
          .map((issue) => issue.workflowId)
          .filter((workflowId): workflowId is string => Boolean(workflowId)),
      ),
    );

    if (workflowIds.length === 0) {
      return [];
    }

    const workflows = await this.prisma.workflow.findMany({
      where: {
        workspaceId,
        id: {
          in: workflowIds,
        },
      },
      include: projectWorkflowInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const issueCountByWorkflowId = issues.reduce<Record<string, number>>(
      (accumulator, issue) => {
        if (!issue.workflowId || !this.isActiveIssue(issue)) {
          return accumulator;
        }

        accumulator[issue.workflowId] =
          (accumulator[issue.workflowId] ?? 0) + 1;
        return accumulator;
      },
      {},
    );

    return workflows.map((workflow) => ({
      ...workflow,
      issueCount: issueCountByWorkflowId[workflow.id] ?? 0,
    }));
  }

  private buildProjectMetrics(
    project: ProjectReadModel,
    issues: ProjectSummaryIssue[],
    workflowCount: number,
  ) {
    const activeIssues = issues.filter((issue) => this.isActiveIssue(issue));
    const completedIssues = issues.filter((issue) =>
      this.isCompletedIssue(issue),
    ).length;
    const completionBaseIssueCount = activeIssues.length + completedIssues;
    const blockedIssues = activeIssues.filter((issue) =>
      this.isBlockedIssue(issue),
    ).length;
    const overdueIssues = activeIssues.filter((issue) =>
      this.isOverdueIssue(issue),
    ).length;
    const highPriorityIssues = activeIssues.filter(
      (issue) =>
        issue.priority === IssuePriority.HIGH ||
        issue.priority === IssuePriority.URGENT,
    ).length;
    const unassignedIssues = activeIssues.filter(
      (issue) =>
        !issue.directAssigneeId &&
        issue.assignees.every((assignee) => !assignee.member?.id),
    ).length;

    return {
      totalIssues: activeIssues.length,
      openIssues: activeIssues.length,
      completedIssues,
      blockedIssues,
      overdueIssues,
      workflowCount,
      workflowIssueCount: activeIssues.filter((issue) =>
        Boolean(issue.workflowId),
      ).length,
      highPriorityIssues,
      unassignedIssues,
      completionRate:
        completionBaseIssueCount > 0
          ? Math.round((completedIssues / completionBaseIssueCount) * 100)
          : 0,
      staleSyncDays: project.lastSyncAt
        ? Math.floor(
            (Date.now() - new Date(project.lastSyncAt).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null,
    };
  }

  private buildIssueBreakdown(issues: ProjectSummaryIssue[]) {
    const initialBreakdown = {
      [IssueStateCategory.BACKLOG]: 0,
      [IssueStateCategory.TODO]: 0,
      [IssueStateCategory.IN_PROGRESS]: 0,
      [IssueStateCategory.DONE]: 0,
      [IssueStateCategory.CANCELED]: 0,
    };

    return issues.reduce((accumulator, issue) => {
      const category = issue.state?.category;
      if (!category) {
        accumulator[IssueStateCategory.BACKLOG] += 1;
        return accumulator;
      }

      accumulator[category] += 1;
      return accumulator;
    }, initialBreakdown);
  }

  private buildAttentionItems(
    project: ProjectReadModel,
    metrics: ReturnType<ProjectService['buildProjectMetrics']>,
    issues: ProjectSummaryIssue[],
  ) {
    const attentionItems: Array<{
      id: string;
      severity: 'low' | 'medium' | 'high';
      title: string;
      description: string;
    }> = [];

    if (
      project.riskLevel === ProjectRiskLevelValue.HIGH ||
      project.riskLevel === ProjectRiskLevelValue.CRITICAL
    ) {
      attentionItems.push({
        id: 'risk-level',
        severity: 'high',
        title: '项目风险等级偏高',
        description: `当前项目被标记为 ${project.riskLevel.toLowerCase()} 风险，建议优先处理卡点和同步节奏。`,
      });
    }

    if (metrics.blockedIssues > 0) {
      attentionItems.push({
        id: 'blocked-issues',
        severity: 'high',
        title: '存在阻塞中的任务',
        description: `当前有 ${metrics.blockedIssues} 个任务处于阻塞状态，需要明确解阻负责人。`,
      });
    }

    if (metrics.overdueIssues > 0) {
      attentionItems.push({
        id: 'overdue-issues',
        severity: 'medium',
        title: '有任务已经延期',
        description: `${metrics.overdueIssues} 个任务已超过截止时间，项目节奏需要重新校准。`,
      });
    }

    if ((metrics.staleSyncDays ?? 0) >= 7) {
      attentionItems.push({
        id: 'stale-sync',
        severity: 'medium',
        title: '项目同步已滞后',
        description: `距离上次同步已过去 ${metrics.staleSyncDays} 天，建议更新项目现状与风险。`,
      });
    }

    const urgentUnassignedCount = issues.filter(
      (issue) =>
        this.isActiveIssue(issue) &&
        issue.priority === IssuePriority.URGENT &&
        !issue.directAssigneeId &&
        issue.assignees.every((assignee) => !assignee.member?.id),
    ).length;

    if (urgentUnassignedCount > 0) {
      attentionItems.push({
        id: 'urgent-unassigned',
        severity: 'high',
        title: '关键任务还没有负责人',
        description: `${urgentUnassignedCount} 个紧急任务尚未分配到人，容易形成远程协作中的等待。`,
      });
    }

    if (attentionItems.length === 0) {
      attentionItems.push({
        id: 'healthy',
        severity: 'low',
        title: '当前协作节奏稳定',
        description:
          '没有检测到明显的阻塞或延期信号，可以继续围绕关键 Issue 推进。',
      });
    }

    return attentionItems;
  }

  private isCompletedIssue(issue: ProjectSummaryIssue) {
    return this.getIssueCategory(issue) === IssueStateCategory.DONE;
  }

  private getIssueCategory(issue: ProjectSummaryIssue) {
    return issue.state?.category ?? IssueStateCategory.BACKLOG;
  }

  private isActiveIssue(issue: ProjectSummaryIssue) {
    return ACTIVE_ISSUE_STATE_CATEGORIES.has(this.getIssueCategory(issue));
  }

  private isBlockedIssue(issue: ProjectSummaryIssue) {
    if (issue.currentStepStatus === IssueStatus.BLOCKED) {
      return true;
    }

    const stateName = issue.state?.name?.toLowerCase() ?? '';
    return (
      stateName.includes('blocked') ||
      stateName.includes('block') ||
      stateName.includes('阻塞') ||
      stateName.includes('卡住')
    );
  }

  private isOverdueIssue(issue: ProjectSummaryIssue) {
    if (!issue.dueDate || !this.isActiveIssue(issue)) {
      return false;
    }

    return new Date(issue.dueDate).getTime() < Date.now();
  }

  private compareIssuesByImportance(
    left: ProjectSummaryIssue,
    right: ProjectSummaryIssue,
  ) {
    const blockedDelta =
      Number(this.isBlockedIssue(right)) - Number(this.isBlockedIssue(left));
    if (blockedDelta !== 0) {
      return blockedDelta;
    }

    const overdueDelta =
      Number(this.isOverdueIssue(right)) - Number(this.isOverdueIssue(left));
    if (overdueDelta !== 0) {
      return overdueDelta;
    }

    const priorityDelta =
      this.getIssuePriorityWeight(right.priority) -
      this.getIssuePriorityWeight(left.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const dueDateDelta = this.getIssueDueDateWeight(
      left.dueDate,
      right.dueDate,
    );
    if (dueDateDelta !== 0) {
      return dueDateDelta;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  }

  private getIssuePriorityWeight(priority: IssuePriority | null) {
    switch (priority) {
      case IssuePriority.URGENT:
        return 4;
      case IssuePriority.HIGH:
        return 3;
      case IssuePriority.NORMAL:
        return 2;
      case IssuePriority.LOW:
        return 1;
      default:
        return 0;
    }
  }

  private getIssueDueDateWeight(
    leftDueDate: Date | null,
    rightDueDate: Date | null,
  ) {
    if (!leftDueDate && !rightDueDate) {
      return 0;
    }

    if (!leftDueDate) {
      return 1;
    }

    if (!rightDueDate) {
      return -1;
    }

    return leftDueDate.getTime() - rightDueDate.getTime();
  }

  private ensureProjectManagementPermission(
    workspace: any,
    userId: string,
    action: '创建' | '更新' | '删除',
  ) {
    if (workspace.type !== 'TEAM') {
      return;
    }

    const currentMember = workspace.team.members.find(
      (member: any) => member.userId === userId,
    );

    if (!currentMember || currentMember.role === Role.MEMBER) {
      throw new ForbiddenException(`只有 OWNER 或 ADMIN 可以${action}项目`);
    }
  }

  private async resolveOwnerMemberId(
    workspaceId: string,
    ownerMemberId?: string,
    fallbackOwnerMemberId?: string,
  ) {
    const resolvedOwnerMemberId = ownerMemberId ?? fallbackOwnerMemberId;

    if (!resolvedOwnerMemberId) {
      throw new BadRequestException('项目负责人不能为空');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        type: true,
        userId: true,
        teamId: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('工作空间不存在');
    }

    const ownerMember = await this.prisma.teamMember.findUnique({
      where: { id: resolvedOwnerMemberId },
      select: {
        id: true,
        userId: true,
        teamId: true,
      },
    });

    if (!ownerMember) {
      throw new BadRequestException('项目负责人不存在');
    }

    if (
      workspace.type === 'TEAM' &&
      workspace.teamId &&
      ownerMember.teamId !== workspace.teamId
    ) {
      throw new BadRequestException('项目负责人必须属于当前团队工作空间');
    }

    if (
      workspace.type === 'PERSONAL' &&
      workspace.userId &&
      ownerMember.userId !== workspace.userId
    ) {
      throw new BadRequestException('个人工作空间项目负责人必须为当前用户');
    }

    return ownerMember.id;
  }

  private async getProjectRecords(workspaceId: string, projectId?: string) {
    const projectIdFilter = projectId
      ? Prisma.sql`AND p."id" = ${projectId}`
      : Prisma.empty;

    const records = await this.prisma.$queryRaw<ProjectReadRecord[]>(
      Prisma.sql`
        SELECT
          p."id",
          p."name",
          p."description",
          p."brief",
          p."status",
          p."phase",
          p."risk_level",
          p."workspace_id",
          p."created_at",
          p."updated_at",
          p."creator_id",
          p."owner_member_id",
          p."last_sync_at",
          p."visibility",
          w."name" AS workspace_name,
          w."type" AS workspace_type,
          tm."id" AS owner_id,
          tm."user_id" AS owner_user_id,
          tm."role" AS owner_role,
          u."name" AS owner_name,
          u."email" AS owner_email,
          u."avatar_url" AS owner_avatar_url
        FROM "projects" p
        INNER JOIN "workspaces" w ON w."id" = p."workspace_id"
        LEFT JOIN "team_members" tm ON tm."id" = p."owner_member_id"
        LEFT JOIN "users" u ON u."id" = tm."user_id"
        WHERE p."workspace_id" = ${workspaceId}
        ${projectIdFilter}
        ORDER BY p."updated_at" DESC
      `,
    );

    return records.map((record) => this.mapProjectRecord(record));
  }

  private mapProjectRecord(record: ProjectReadRecord): ProjectReadModel {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      brief: record.brief,
      status: record.status,
      phase: record.phase,
      riskLevel: record.risk_level,
      workspaceId: record.workspace_id,
      createdAt: this.toIsoString(record.created_at),
      updatedAt: this.toIsoString(record.updated_at),
      creatorId: record.creator_id,
      ownerMemberId: record.owner_member_id,
      lastSyncAt: record.last_sync_at
        ? this.toIsoString(record.last_sync_at)
        : null,
      visibility: record.visibility,
      workspace: {
        id: record.workspace_id,
        name: record.workspace_name,
        type: record.workspace_type,
      },
      owner:
        record.owner_id &&
        record.owner_user_id &&
        record.owner_role &&
        record.owner_email
          ? {
              id: record.owner_id,
              userId: record.owner_user_id,
              role: record.owner_role,
              user: {
                id: record.owner_user_id,
                name: record.owner_name,
                email: record.owner_email,
                avatarUrl: record.owner_avatar_url,
              },
            }
          : null,
    };
  }

  private toIsoString(value: Date | string) {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }

  private async findProjectOrThrow(workspaceId: string, projectId: string) {
    const projects = await this.getProjectRecords(workspaceId, projectId);
    const project = projects[0];

    if (!project) {
      throw new NotFoundException(`项目 ${projectId} 不存在`);
    }

    return project;
  }
}
