import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamMemberService {
  constructor(private prisma: PrismaService) {}

  /**
   * 根据User ID和工作空间ID获取对应的TeamMember ID
   * @param userId 用户ID
   * @param workspaceId 工作空间ID
   * @returns TeamMember ID
   */
  async getTeamMemberIdByWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<string> {
    // 查找工作空间
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('工作空间不存在');
    }

    // 如果是个人工作空间，获取用户的第一个TeamMember身份
    if (workspace.type === 'PERSONAL') {
      if (workspace.userId !== userId) {
        throw new NotFoundException('无权限访问此工作空间');
      }

      const teamMember = await this.prisma.teamMember.findFirst({
        where: { userId },
      });

      if (!teamMember) {
        throw new NotFoundException('用户没有团队成员身份');
      }

      return teamMember.id;
    }

    // 如果是团队工作空间，获取对应的TeamMember
    if (workspace.type === 'TEAM') {
      const teamMember = workspace.team.members.find(
        (m) => m.userId === userId,
      );
      if (!teamMember) {
        throw new NotFoundException('用户不是该团队成员');
      }
      return teamMember.id;
    }

    throw new NotFoundException('无效的工作空间类型');
  }

  /**
   * 根据User ID获取默认的TeamMember ID（用于没有明确工作空间上下文的情况）
   * @param userId 用户ID
   * @returns 默认的TeamMember ID
   */
  async getDefaultTeamMemberId(userId: string): Promise<string> {
    const teamMember = await this.prisma.teamMember.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' }, // 获取最早加入的团队
    });

    if (!teamMember) {
      throw new NotFoundException('用户没有团队成员身份');
    }

    return teamMember.id;
  }

  /**
   * 验证用户是否有权访问指定工作空间
   * @param userId 用户ID
   * @param workspaceId 工作空间ID
   * @returns 工作空间信息和对应的TeamMember ID
   */
  async validateWorkspaceAccess(userId: string, workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        team: {
          include: {
            members: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('工作空间不存在');
    }

    let teamMemberId: string;

    if (workspace.type === 'PERSONAL') {
      if (workspace.userId !== userId) {
        throw new NotFoundException('无权限访问此工作空间');
      }
      teamMemberId = await this.getDefaultTeamMemberId(userId);
    } else {
      const teamMember = workspace.team.members.find(
        (m) => m.userId === userId,
      );
      if (!teamMember) {
        throw new NotFoundException('用户不是该团队成员');
      }
      teamMemberId = teamMember.id;
    }

    return { workspace, teamMemberId };
  }
}
