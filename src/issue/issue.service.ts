import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, VisibilityType, IssueStateCategory } from '../../prisma/generated/prisma/client';
import { CreateIssueDto } from './dto/create-issue.dto';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateWorkflowIssueDto } from './dto/create-workflow-issue.dto';
import { CreateIssueStepRecordDto } from './dto/create-issue-step-record.dto';
import { CreateIssueActivityDto } from './dto/create-issue-activity.dto';
import { QueryIssueDto, IssueScope } from './dto/query-issue.dto';
import { IssueStateService } from '../issue-state/issue-state.service';

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly issueStateService: IssueStateService,
  ) {}

  /**
   * MARK: - 创建任务 (简化版)
   * @param userId 当前认证用户 ID
   * @param createIssueDto 创建任务的数据
   * @returns 创建的任务对象
   */
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

    // 获取创建者的 TeamMember ID
    const creatorMemberId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    // 获取默认状态（如果未指定）
    let finalStateId = stateId;
    if (!finalStateId) {
      const defaultState = await this.issueStateService.getDefaultState(workspaceId);
      finalStateId = defaultState?.id;
    }

    // 生成 key 和 sequence
    const { key, sequence } = await this.generateIssueKey(workspaceId);

    // 创建 Issue (使用 unchecked create 直接传入外键)
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

    // 创建 assignees 关联
    if (assigneeIds && assigneeIds.length > 0) {
      await this.prisma.issueAssignee.createMany({
        data: assigneeIds.map((memberId) => ({
          issueId: issue.id,
          memberId,
        })),
      });
    }

    // 创建 labels 关联
    if (labelIds && labelIds.length > 0) {
      await this.prisma.issueLabel.createMany({
        data: labelIds.map((labelId) => ({
          issueId: issue.id,
          labelId,
        })),
      });
    }

    return this.findOne(issue.id);
  }

  /**
   * 生成 Issue key 和 sequence
   */
  private async generateIssueKey(workspaceId: string): Promise<{ key: string; sequence: number }> {
    // 获取 workspace 的 prefix
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { issuePrefix: true, name: true },
    });

    // 如果没有设置 prefix，使用 workspace 名称的前 3 个字符
    const prefix = workspace?.issuePrefix || workspace?.name?.substring(0, 3).toUpperCase() || 'ISS';

    // 获取当前 workspace 的最大 sequence
    const maxSequence = await this.prisma.issue.aggregate({
      where: { workspaceId },
      _max: { sequence: true },
    });

    const sequence = (maxSequence._max.sequence ?? 0) + 1;
    const key = `${prefix}-${sequence}`;

    return { key, sequence };
  }

  /**
   * 获取单个 Issue
   */
  async findOne(issueId: string) {
    return this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
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
      },
    });
  }

  /*
   * MARK: - +基于Flow的任务
   * @param userId 当前认证用户 ID
   * @param createIssueDto 创建任务的数据
   * @returns 创建的任务对象
   */
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
      workflowSnapshot,
      totalSteps,
      currentStepId,
      currentStepIndex,
      currentStepStatus,
    } = createWorkflowIssueDto;

    // 获取创建者的 TeamMember ID
    const creatorId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    return this.prisma.issue.create({
      data: {
        title,
        description,
        creatorId,
        workflowId,
        dueDate,
        workspace: {
          connect: { id: workspaceId },
        },
        totalSteps,
        currentStepId,
        currentStepIndex,
        currentStepStatus,
        workflowSnapshot: JSON.parse(workflowSnapshot),
      },
    });
  }

  /**
   * MARK: - 获取所有任务 (支持 scope 过滤)
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID
   * @param query 查询参数
   * @returns 任务列表
   */
  async findAll(workspaceId: string, userId: string, query?: QueryIssueDto) {
    // 验证用户有权访问该工作空间
    const teamMemberId = await this.teamMemberService.getTeamMemberIdByWorkspace(
      userId,
      workspaceId,
    );

    // 构建 where 条件
    const where: Prisma.IssueWhereInput = {
      workspaceId,
    };

    // scope 过滤
    if (query?.scope === IssueScope.PERSONAL) {
      // 个人 Issue：visibility 为 PRIVATE 且 creatorMemberId 为当前用户
      where.visibility = VisibilityType.PRIVATE;
      where.creatorMemberId = teamMemberId;
    } else if (query?.scope === IssueScope.TEAM) {
      // 团队 Issue：visibility 不为 PRIVATE
      where.visibility = { not: VisibilityType.PRIVATE };
    }
    // scope === 'all' 时不添加额外过滤

    // 其他过滤条件
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

    // 排序
    const orderBy: Prisma.IssueOrderByWithRelationInput = {};
    const sortField = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder || 'desc';
    orderBy[sortField] = sortOrder;

    // 分页
    const take = query?.limit || 50;
    const cursor = query?.cursor ? { id: query.cursor } : undefined;
    const skip = cursor ? 1 : 0;

    return this.prisma.issue.findMany({
      where,
      orderBy,
      take,
      skip,
      cursor,
      include: {
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
      },
    });
  }

  /**
   * MARK: - 更新 Issue（局部字段）
   */
  async update(
    userId: string,
    workspaceId: string,
    issueId: string,
    updateDto: Record<string, any>,
  ) {
    // 验证用户对 workspace 有访问权限
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.issue.update({
      where: { id: issueId },
      data: updateDto,
    });
  }

  /**
   * MARK: - 删除 Issue
   */
  async remove(userId: string, workspaceId: string, issueId: string) {
    // 权限检查
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.issue.delete({
      where: { id: issueId },
    });
  }

  /**
   * MARK: - 创建 StepRecord
   */
  async addStepRecord(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: CreateIssueStepRecordDto,
  ) {
    // 权限验证
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 将传入的 assigneeId (Supabase userId) 转为 TeamMemberId
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
    });
  }

  async listStepRecords(userId: string, workspaceId: string, issueId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    return this.prisma.issueStepRecord.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * MARK: - 创建 IssueActivity
   */
  async addIssueActivity(
    userId: string,
    workspaceId: string,
    issueId: string,
    dto: CreateIssueActivityDto,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 获取操作者 teamMemberId
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
    });
  }

  async listIssueActivities(
    userId: string,
    workspaceId: string,
    issueId: string,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    return this.prisma.issueActivity.findMany({
      where: { issueId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
