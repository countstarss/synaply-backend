import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceType } from '../../prisma/generated/prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';

@Injectable()
export class WorkspaceService {
  constructor(
    private prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

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
}
