import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { IssuePriority, IssueStatus, VisibilityType } from '@prisma/client';
import { IssueSearchFilters } from 'src/common/graphql/types/query-result.types';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly permissionService: PermissionService,
  ) {}

  // MARK: - 创建任务
  async create(userId: string, createIssueDto: CreateIssueDto) {
    const {
      workflowId,
      currentStepId,
      directAssigneeId,
      workspaceId,
      projectId,
      title,
      description,
      dueDate,
      startDate,
      priority,
      parentTaskId,
      visibility = VisibilityType.PRIVATE,
    } = createIssueDto;

    if (workflowId && directAssigneeId) {
      throw new BadRequestException(
        'Cannot assign both a workflow and a direct assignee.',
      );
    }

    if (workflowId && !currentStepId) {
      throw new BadRequestException(
        'currentStepId is required when workflowId is provided.',
      );
    }

    // 获取创建者的TeamMember ID
    const creatorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          title,
          description,
          workspace: {
            connect: { id: workspaceId },
          },
          project: projectId ? { connect: { id: projectId } } : undefined,
          creator: {
            connect: { id: creatorId },
          },
          status: IssueStatus.TODO,
          priority: priority || IssuePriority.NORMAL,
          visibility,
          dueDate,
          startDate,
          workflow: workflowId ? { connect: { id: workflowId } } : undefined,
          currentStep: currentStepId
            ? { connect: { id: currentStepId } }
            : undefined,
          directAssignee: directAssigneeId
            ? { connect: { id: directAssigneeId } }
            : undefined,
          parentTask: parentTaskId
            ? { connect: { id: parentTaskId } }
            : undefined,
        },
        include: {
          creator: {
            include: { user: true },
          },
          workspace: true,
        },
      });

      await tx.issueActivity.create({
        data: {
          issue: { connect: { id: issue.id } },
          actor: { connect: { id: creatorId } },
          toStepName: 'Created',
          comment: 'Issue created.',
        },
      });

      return issue;
    });
  }

  // MARK: - 获取所有任务
  async findAll(workspaceId: string, userId: string, projectId?: string) {
    // 验证用户有权访问该工作空间
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 获取用户有权限查看的任务
    const issues = await this.prisma.issue.findMany({
      where: {
        workspaceId,
        projectId: projectId || undefined,
      },
      include: {
        creator: {
          include: { user: true },
        },
        directAssignee: {
          include: { user: true },
        },
        workflow: true,
        currentStep: true,
        parentTask: true,
        project: true,
        workspace: {
          include: {
            team: {
              include: {
                members: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 过滤用户有权限查看的任务
    const filteredIssues = [];
    for (const issue of issues) {
      const hasPermission =
        await this.permissionService.checkResourcePermission(
          userId,
          'issue',
          issue.id,
          'read',
        );
      if (hasPermission) {
        filteredIssues.push(issue);
      }
    }

    return filteredIssues;
  }

  // MARK: - 获取单个任务
  async findOne(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      id,
      'read',
    );

    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        creator: {
          include: { user: true },
        },
        directAssignee: {
          include: { user: true },
        },
        workflow: true,
        currentStep: true,
        parentTask: true,
        subtasks: true,
        project: true,
        comments: {
          include: {
            author: {
              include: { user: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
        },
        blockingIssues: {
          include: { blockerIssue: true },
        },
        dependsOnIssues: {
          include: { dependsOnIssue: true },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException(`任务 ${id} 不存在`);
    }

    return issue;
  }

  // MARK: - 更新任务
  async update(id: string, updateIssueDto: UpdateIssueDto, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      id,
      'write',
    );

    const {
      status,
      priority,
      dueDate,
      startDate,
      currentStepId,
      title,
      description,
      directAssigneeId,
    } = updateIssueDto;

    const existingIssue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        currentStep: true,
        creator: true,
      },
    });

    if (!existingIssue) {
      throw new NotFoundException(`任务 ${id} 不存在`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedIssue = await tx.issue.update({
        where: { id },
        data: {
          title: title ?? existingIssue.title,
          description: description ?? existingIssue.description,
          status: status ?? existingIssue.status,
          priority: priority ?? existingIssue.priority,
          dueDate: dueDate ?? existingIssue.dueDate,
          startDate: startDate ?? existingIssue.startDate,
          currentStep: currentStepId
            ? { connect: { id: currentStepId } }
            : undefined,
          directAssignee: directAssigneeId
            ? { connect: { id: directAssigneeId } }
            : undefined,
        },
      });

      // Record activity for status or step changes
      if (status && status !== existingIssue.status) {
        await tx.issueActivity.create({
          data: {
            issue: { connect: { id: updatedIssue.id } },
            actor: { connect: { id: existingIssue.creatorId } },
            fromStepName: existingIssue.status,
            toStepName: status,
            comment: `Status changed from ${existingIssue.status} to ${status}.`,
          },
        });
      }

      if (currentStepId && currentStepId !== existingIssue.currentStepId) {
        const newStep = await tx.workflowStep.findUnique({
          where: { id: currentStepId },
        });
        await tx.issueActivity.create({
          data: {
            issue: { connect: { id: updatedIssue.id } },
            actor: { connect: { id: existingIssue.creatorId } },
            fromStepName: existingIssue.currentStep?.name || 'N/A',
            toStepName: newStep?.name || 'N/A',
            comment: `Moved to step: ${newStep?.name || 'N/A'}.`,
          },
        });
      }

      return updatedIssue;
    });
  }

  // MARK: - 删除任务
  async remove(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      id,
      'delete',
    );

    // Delete associated comments
    await this.prisma.comment.deleteMany({
      where: { issueId: id },
    });

    // Delete associated activities
    await this.prisma.issueActivity.deleteMany({
      where: { issueId: id },
    });

    // Delete associated dependencies (where this issue is either blocker or dependsOn)
    await this.prisma.issueDependency.deleteMany({
      where: {
        OR: [{ blockerIssueId: id }, { dependsOnIssueId: id }],
      },
    });

    // Finally, delete the issue itself
    return this.prisma.issue.delete({
      where: { id },
    });
  }

  // MARK: - 添加评论
  async addComment(
    issueId: string,
    userId: string,
    createCommentDto: CreateCommentDto,
  ) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    // 获取评论者的TeamMember ID
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      select: { workspaceId: true },
    });

    if (!issue) {
      throw new NotFoundException('任务不存在');
    }

    const authorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      issue.workspaceId,
    );

    const { content } = createCommentDto;
    return this.prisma.comment.create({
      data: {
        content,
        issue: { connect: { id: issueId } },
        author: { connect: { id: authorId } },
      },
    });
  }

  // MARK: - 添加依赖
  async addDependency(
    issueId: string,
    createIssueDependencyDto: CreateIssueDependencyDto,
    userId: string,
  ) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'issue',
      issueId,
      'write',
    );

    const { dependsOnIssueId } = createIssueDependencyDto;

    // Check if both issues exist
    const [issue, dependsOnIssue] = await this.prisma.$transaction([
      this.prisma.issue.findUnique({ where: { id: issueId } }),
      this.prisma.issue.findUnique({ where: { id: dependsOnIssueId } }),
    ]);

    if (!issue) {
      throw new NotFoundException(`任务 ${issueId} 不存在`);
    }
    if (!dependsOnIssue) {
      throw new NotFoundException(`依赖任务 ${dependsOnIssueId} 不存在`);
    }

    // Prevent self-dependency
    if (issueId === dependsOnIssueId) {
      throw new BadRequestException('任务不能依赖自己');
    }

    // Prevent circular dependency (simple check for direct circularity)
    const existingDependency = await this.prisma.issueDependency.findUnique({
      where: {
        blockerIssueId_dependsOnIssueId: {
          blockerIssueId: dependsOnIssueId,
          dependsOnIssueId: issueId,
        },
      },
    });
    if (existingDependency) {
      throw new BadRequestException('检测到循环依赖');
    }

    return this.prisma.issueDependency.create({
      data: {
        blockerIssue: { connect: { id: issueId } },
        dependsOnIssue: { connect: { id: dependsOnIssueId } },
      },
    });
  }

  // MARK: - 搜索任务
  async searchIssues(
    userId: string,
    searchTerm: string,
    filters?: IssueSearchFilters,
  ) {
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

    if (filters) {
      if (filters.status) whereClause.status = filters.status;
      if (filters.priority) whereClause.priority = filters.priority;
      if (filters.assigneeId) whereClause.directAssigneeId = filters.assigneeId;
      if (filters.projectId) whereClause.projectId = filters.projectId;
      if (filters.workspaceId && workspaceIds.includes(filters.workspaceId)) {
        whereClause.workspaceId = filters.workspaceId;
      }
    }

    const issues = await this.prisma.issue.findMany({
      where: whereClause,
      include: {
        workspace: true,
        project: true,
        creator: {
          include: { user: true },
        },
        directAssignee: {
          include: { user: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // 过滤用户有权限查看的任务
    const filteredIssues = [];
    for (const issue of issues) {
      const hasPermission =
        await this.permissionService.checkResourcePermission(
          userId,
          'issue',
          issue.id,
          'read',
        );
      if (hasPermission) {
        filteredIssues.push(issue);
      }
    }

    return filteredIssues;
  }
}
