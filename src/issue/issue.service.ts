import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { TeamMemberService } from '../common/services/team-member.service';

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
}
