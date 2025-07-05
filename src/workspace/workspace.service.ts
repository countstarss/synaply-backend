import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceType } from '@prisma/client';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取用户的所有工作空间（包括个人空间和所属团队的空间）
   * @param userId 用户 ID
   * @returns 工作空间列表
   */
  // MARK: 获取用户所有工作空间
  async getUserWorkspaces(userId: string) {
    // 获取个人工作空间
    const personalWorkspaces = await this.prisma.workspace.findMany({
      where: {
        userId: userId,
        type: WorkspaceType.PERSONAL,
      },
    });

    // 获取用户所属团队的工作空间
    const teamWorkspaces = await this.prisma.teamMember.findMany({
      where: { userId: userId },
      include: {
        team: {
          include: {
            workspace: true,
          },
        },
      },
    });

    const workspaces = [
      ...personalWorkspaces,
      ...teamWorkspaces.map((tm) => tm.team.workspace),
    ].filter(Boolean); // 过滤掉可能为空的团队工作空间

    return workspaces;
  }

  /**
   * 根据 ID 获取工作空间详情
   * @param workspaceId 工作空间 ID
   * @returns 工作空间对象
   */
  // MARK: 根据ID获取空间详情
  async getWorkspaceById(workspaceId: string) {
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { user: true, team: true }, // 包含关联的用户或团队信息
    });
  }

  // MARK: 获取用户所有工作空间
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
