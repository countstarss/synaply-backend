import {
  Injectable,
  BadRequestException,
  // NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
// import { UpdateIssueDto } from './dto/update-issue.dto';
// import { CreateCommentDto } from './dto/create-comment.dto';
// import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { IssuePriority, IssueStatus, VisibilityType } from '@prisma/client';
// import { IssueSearchFilters } from 'src/common/graphql/types/query-result.types';
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
          currentStepId: currentStepId || null,
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
}
