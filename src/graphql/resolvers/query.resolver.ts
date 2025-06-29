import { Resolver, Query, Args, ID, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { Workspace } from '../types/workspace.type';
import { Issue } from '../types/issue.type';
import {
  IssueSearchFilters,
  WorkspaceStats,
  ProjectDetails,
  TeamMemberWorkload,
} from '../types/query-result.types';

@Resolver()
@UseGuards(SupabaseAuthGuard)
export class QueryResolver {
  constructor(private prisma: PrismaService) {}

  // 获取用户的所有工作空间及其关联数据
  // MARK: myWorkspacesWithDetails
  @Query(() => [Workspace], { name: 'myWorkspacesWithDetails' })
  async getMyWorkspacesWithDetails(@Context() ctx) {
    const userId = ctx.req.user.sub;

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
      include: {
        user: true,
        team: {
          include: {
            members: {
              include: {
                user: true,
              },
            },
          },
        },
        projects: true,
        workflows: {
          include: {
            steps: {
              include: {
                assignee: {
                  include: {
                    user: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // 获取工作空间的详细统计信息
  // MARK: workspaceStats
  @Query(() => WorkspaceStats, { name: 'workspaceStats' })
  async getWorkspaceStats(
    @Args('workspaceId', { type: () => ID }) workspaceId: string,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;

    // 验证用户有权访问该工作空间
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
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

    if (!workspace) {
      throw new Error('Workspace not found or access denied');
    }

    // 并行获取各种统计数据
    const [
      totalProjects,
      totalIssues,
      issuesByStatus,
      issuesByPriority,
      overdueIssues,
      upcomingDeadlines,
      teamMembers,
    ] = await Promise.all([
      this.prisma.project.count({ where: { workspaceId } }),
      this.prisma.issue.count({ where: { workspaceId } }),
      this.prisma.issue.groupBy({
        by: ['status'],
        where: { workspaceId },
        _count: true,
      }),
      this.prisma.issue.groupBy({
        by: ['priority'],
        where: { workspaceId },
        _count: true,
      }),
      this.prisma.issue.count({
        where: {
          workspaceId,
          dueDate: { lt: new Date() },
          status: { not: 'DONE' },
        },
      }),
      this.prisma.issue.findMany({
        where: {
          workspaceId,
          dueDate: {
            gte: new Date(),
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天内
          },
          status: { not: 'DONE' },
        },
        include: {
          directAssignee: {
            include: { user: true },
          },
          project: true,
          creator: {
            include: { user: true },
          },
        },
      }),
      workspace.teamId
        ? this.prisma.teamMember.count({
            where: { teamId: workspace.teamId },
          })
        : 0,
    ]);

    return {
      workspaceId,
      totalProjects,
      totalIssues,
      issuesByStatus: issuesByStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      issuesByPriority: issuesByPriority.map((item) => ({
        priority: item.priority,
        count: item._count,
      })),
      overdueIssues,
      upcomingDeadlines,
      teamMembersCount: teamMembers,
    };
  }

  // 获取项目的详细信息，包括所有任务及其关系
  // MARK: projectDetails
  @Query(() => ProjectDetails, { name: 'projectDetails' })
  async getProjectDetails(
    @Args('projectId', { type: () => ID }) projectId: string,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
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
      },
      include: {
        workspace: {
          include: {
            team: {
              include: {
                members: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // 获取项目的所有任务，包括依赖关系
    const issues = await this.prisma.issue.findMany({
      where: { projectId },
      include: {
        creator: { include: { user: true } },
        directAssignee: { include: { user: true } },
        workflow: {
          include: {
            steps: true,
          },
        },
        currentStep: true,
        parentTask: true,
        subtasks: true,
        project: true,
        comments: {
          include: {
            author: { include: { user: true } },
          },
        },
        activities: {
          include: {
            actor: { include: { user: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        blockingIssues: {
          include: {
            blockerIssue: true,
          },
        },
        dependsOnIssues: {
          include: {
            dependsOnIssue: true,
          },
        },
      },
    });

    // 构建任务依赖图
    const dependencyGraph = this.buildDependencyGraph(issues);

    return {
      ...project,
      issues,
      dependencyGraph,
    };
  }

  // 搜索任务（跨工作空间）
  // MARK: searchIssues
  @Query(() => [Issue], { name: 'searchIssues' })
  async searchIssues(
    @Args('searchTerm') searchTerm: string,
    @Args('filters', { type: () => IssueSearchFilters, nullable: true })
    filters: IssueSearchFilters,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;

    // 获取用户有权访问的所有工作空间
    const accessibleWorkspaces = await this.prisma.workspace.findMany({
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
      select: { id: true },
    });

    const workspaceIds = accessibleWorkspaces.map((w) => w.id);

    const whereClause: any = {
      workspaceId: { in: workspaceIds },
      OR: [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
      ],
    };

    // 应用过滤器
    if (filters) {
      if (filters.status) whereClause.status = filters.status;
      if (filters.priority) whereClause.priority = filters.priority;
      if (filters.assigneeId) whereClause.directAssigneeId = filters.assigneeId;
      if (filters.projectId) whereClause.projectId = filters.projectId;
      if (filters.workspaceId && workspaceIds.includes(filters.workspaceId)) {
        whereClause.workspaceId = filters.workspaceId;
      }
    }

    return this.prisma.issue.findMany({
      where: whereClause,
      include: {
        workspace: true,
        project: true,
        creator: { include: { user: true } },
        directAssignee: { include: { user: true } },
        workflow: true,
        currentStep: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50, // 限制结果数量
    });
  }

  // 获取团队成员的工作负载
  // MARK: teamWorkload
  @Query(() => [TeamMemberWorkload], { name: 'teamWorkload' })
  async getTeamWorkload(
    @Args('teamId', { type: () => ID }) teamId: string,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;

    // 验证用户是团队成员
    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId },
    });

    if (!membership) {
      throw new Error('Not a member of this team');
    }

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: true,
        directlyAssignedIssues: {
          where: {
            status: { not: 'DONE' },
          },
        },
      },
    });

    const workloads = await Promise.all(
      members.map(async (member) => {
        const [todoCount, inProgressCount, blockedCount, overdueCount] =
          await Promise.all([
            this.prisma.issue.count({
              where: {
                directAssigneeId: member.id,
                status: 'TODO',
              },
            }),
            this.prisma.issue.count({
              where: {
                directAssigneeId: member.id,
                status: 'IN_PROGRESS',
              },
            }),
            this.prisma.issue.count({
              where: {
                directAssigneeId: member.id,
                status: 'BLOCKED',
              },
            }),
            this.prisma.issue.count({
              where: {
                directAssigneeId: member.id,
                status: { not: 'DONE' },
                dueDate: { lt: new Date() },
              },
            }),
          ]);

        return {
          member,
          todoCount,
          inProgressCount,
          blockedCount,
          overdueCount,
          totalActiveIssues: todoCount + inProgressCount + blockedCount,
        };
      }),
    );

    return workloads;
  }

  // 辅助方法：构建依赖图
  private buildDependencyGraph(issues: any[]) {
    const nodes = issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
    }));

    const edges = [];
    issues.forEach((issue) => {
      issue.blockingIssues?.forEach((dep) => {
        edges.push({
          from: dep.blockerIssueId,
          to: issue.id,
          type: 'blocks',
        });
      });
    });

    return { nodes, edges };
  }
}
