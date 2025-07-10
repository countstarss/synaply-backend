import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateIssueDto } from './dto/create-issue.dto';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateWorkflowIssueDto } from './dto/create-workflow-issue.dto';
import { CreateIssueStepRecordDto } from './dto/create-issue-step-record.dto';
import { CreateIssueActivityDto } from './dto/create-issue-activity.dto';

@Injectable()
export class IssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  /**
   * MARK: - 创建任务 (简化版)
   * @param userId 当前认证用户 ID
   * @param createIssueDto 创建任务的数据
   * @returns 创建的任务对象
   */
  async create(userId: string, createIssueDto: CreateIssueDto) {
    const { title, description, workspaceId, directAssigneeId, dueDate } =
      createIssueDto;

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
        directAssigneeId,
        dueDate,
        workspace: {
          connect: { id: workspaceId },
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
   * MARK: - 获取所有任务 (简化版)
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID
   * @returns 任务列表
   */
  async findAll(workspaceId: string, userId: string) {
    // 验证用户有权访问该工作空间
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.issue.findMany({
      where: {
        workspaceId,
      },
      orderBy: {
        createdAt: 'desc',
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
