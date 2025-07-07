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

  /**
   * MARK: - 创建任务
   * @description
   * 思考过程:
   * 1. 目标: 创建一个新的任务，并将其与工作空间、项目、创建者、工作流等关联。
   * 2. 验证: 检查 `workflowId` 和 `directAssigneeId` 是否同时存在（业务逻辑冲突）；检查 `workflowId` 存在时 `currentStepId` 是否也存在。
   * 3. 权限: 获取创建者的 `TeamMember ID`，因为任务的创建者是 `TeamMember`。
   * 4. 事务性: 任务创建和活动日志记录应是原子操作，使用 Prisma 事务确保数据一致性。
   * 5. 默认值: 设置任务的默认状态和优先级。
   * 6. 关联: 使用 `connect` 关联到其他模型。
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @param createIssueDto 创建任务的数据
   * @returns 创建的任务对象
   */
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

  /**
   * MARK: - 获取所有任务
   * @description
   * 思考过程:
   * 1. 目标: 获取指定工作空间下，当前用户有权限查看的所有任务列表，并支持按项目过滤。
   * 2. 权限: 首先验证用户对工作空间的访问权限。然后，对于每个任务，使用 `PermissionService` 检查用户是否有读取权限。
   * 3. 关联: 包含创建者、指派人、工作流、当前步骤、父任务、项目和工作空间信息。
   * 4. 排序: 默认按创建时间倒序排列。
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @param projectId 可选的项目 ID
   * @returns 任务列表
   */
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

  /**
   * MARK: - 获取单个任务
   * @description
   * 思考过程:
   * 1. 目标: 获取单个任务的详细信息，包括其关联的所有子项（评论、活动、依赖等）。
   * 2. 权限: 验证用户对该任务的读取权限。
   * 3. 验证: 如果任务不存在，抛出 `NotFoundException`。
   * 4. 关联: 包含创建者、指派人、工作流、当前步骤、父任务、子任务、项目、评论、活动和依赖信息。
   * 5. 排序: 评论和活动按创建时间排序。
   * @param id 任务 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 任务对象
   */
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

  /**
   * MARK: - 更新任务
   * @description
   * 思考过程:
   * 1. 目标: 更新指定任务的各项信息，并记录相关的活动日志。
   * 2. 权限: 验证用户对该任务的写入权限。
   * 3. 事务性: 任务更新和活动日志记录应是原子操作，使用 Prisma 事务确保数据一致性。
   * 4. 业务逻辑: 记录状态和步骤变化的活动日志。
   * @param id 任务 ID
   * @param updateIssueDto 更新任务的数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 更新后的任务对象
   */
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

  /**
   * MARK: - 删除任务
   * @description
   * 思考过程:
   * 1. 目标: 删除指定任务及其所有关联的评论、活动和依赖。
   * 2. 权限: 验证用户对该任务的删除权限。
   * 3. 级联删除: Prisma 默认不支持多级级联删除，所以需要手动先删除子记录（评论、活动、依赖），再删除父记录（任务）。
   * @param id 任务 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   */
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

  /**
   * MARK: - 添加评论
   * @description
   * 思考过程:
   * 1. 目标: 为指定任务添加一条评论。
   * 2. 权限: 验证用户对该任务的写入权限。
   * 3. 关联: 获取评论者的 `TeamMember ID`，因为评论的作者是 `TeamMember`。
   * 4. 验证: 检查任务是否存在。
   * @param issueId 任务 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @param createCommentDto 评论数据
   * @returns 创建的评论对象
   */
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

  /**
   * MARK: - 添加依赖
   * @description
   * 思考过程:
   * 1. 目标: 为指定任务添加一个依赖关系。
   * 2. 权限: 验证用户对该任务的写入权限。
   * 3. 验证: 检查依赖的任务是否存在；防止任务依赖自身；防止循环依赖（简单检查）。
   * 4. 事务性: 检查任务存在性和创建依赖应是原子操作。
   * @param issueId 任务 ID
   * @param createIssueDependencyDto 依赖数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 创建的依赖对象
   */
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

  /**
   * MARK: - 搜索任务
   * @description
   * 思考过程:
   * 1. 目标: 根据搜索词和过滤器，搜索用户有权限查看的任务。
   * 2. 权限: 首先获取用户有权访问的所有工作空间。然后，在这些工作空间中进行搜索，并再次通过 `PermissionService` 过滤结果。
   * 3. 搜索: 使用 `contains` 和 `mode: 'insensitive'` 进行不区分大小写的模糊搜索。
   * 4. 过滤: 根据 `status`, `priority`, `assigneeId`, `projectId`, `workspaceId` 进行过滤。
   * 5. 关联: 包含工作空间、项目、创建者和指派人信息。
   * 6. 排序和分页: 默认按更新时间倒序排列，并限制返回数量。
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @param searchTerm 搜索关键词
   * @param filters 可选的搜索过滤器
   * @returns 任务列表
   */
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
