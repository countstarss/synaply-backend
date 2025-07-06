import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { Role, WorkspaceType } from '@prisma/client';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建团队
   * @param createTeamDto 团队创建 DTO
   * @param ownerId 团队拥有者 ID
   * @returns 创建的团队对象
   */
  // MARK: - 创建团队
  async createTeam(createTeamDto: CreateTeamDto, ownerId: string) {
    const { name } = createTeamDto;

    // 检查团队名称是否已存在
    const existingTeam = await this.prisma.team.findFirst({
      where: { name },
    });

    if (existingTeam) {
      throw new BadRequestException('Team name already exists.');
    }

    // 创建团队和团队工作空间，并将创建者设置为团队拥有者
    const team = await this.prisma.team.create({
      data: {
        name,
        members: {
          create: {
            userId: ownerId,
            role: Role.OWNER,
          },
        },
        workspace: {
          create: {
            name: `${name} 的团队空间`,
            type: WorkspaceType.TEAM,
          },
        },
      },
      include: { members: true, workspace: true },
    });

    return team;
  }

  /**
   * 邀请成员加入团队
   * @param teamId 团队 ID
   * @param inviteMemberDto 邀请成员 DTO
   * @param inviterId 邀请者 ID
   * @returns 邀请结果
   */
  // MARK: - 邀请加入团队
  async inviteMember(
    teamId: string,
    inviteMemberDto: InviteMemberDto,
    inviterId: string,
  ) {
    const { email } = inviteMemberDto;

    // 检查邀请者是否是团队成员且有权限
    const inviterMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: inviterId } },
    });

    if (
      !inviterMember ||
      (inviterMember.role !== Role.OWNER && inviterMember.role !== Role.ADMIN)
    ) {
      throw new BadRequestException(
        'You are not authorized to invite members to this team.',
      );
    }

    // 查找被邀请用户
    const invitedUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!invitedUser) {
      throw new NotFoundException('Invited user not found.');
    }

    // 检查用户是否已是团队成员
    const existingMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: invitedUser.id } },
    });

    if (existingMember) {
      throw new BadRequestException('User is already a member of this team.');
    }

    // 添加成员
    await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: invitedUser.id,
        role: Role.MEMBER, // 默认角色为成员
      },
    });

    return { message: 'Member invited successfully.' };
  }

  /**
   * 获取团队详情
   * @param teamId 团队 ID
   * @returns 团队对象
   */
  // MARK: - 获取团队详情
  async getTeamById(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { include: { user: true } }, workspace: true },
    });

    if (!team) {
      throw new NotFoundException('Team not found.');
    }
    return team;
  }

  /**
   * 获取用户所属的所有团队
   * @param userId 用户 ID
   * @returns 团队列表
   */
  // MARK: - 用户所属团队
  async getUserTeams(userId: string) {
    const teamMemberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: { workspace: true } } },
    });
    return teamMemberships.map((tm) => tm.team);
  }

  /**
   * 更新团队成员角色
   * @param teamId 团队 ID
   * @param memberId 成员 ID
   * @param newRole 新角色
   * @param currentUserId 当前操作用户 ID
   * @returns 更新后的团队成员
   */
  // MARK: - 更新成员角色
  async updateMemberRole(
    teamId: string,
    memberId: string,
    newRole: Role,
    currentUserId: string,
  ) {
    // 检查当前操作用户是否是团队拥有者或管理员
    const currentUserMembership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: currentUserId } },
    });

    if (
      !currentUserMembership ||
      (currentUserMembership.role !== Role.OWNER &&
        currentUserMembership.role !== Role.ADMIN)
    ) {
      throw new BadRequestException(
        'You are not authorized to change member roles.',
      );
    }

    // 检查目标成员是否存在于该团队
    const targetMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in this team.');
    }

    // 拥有者不能被降级，除非是拥有者自己操作且团队有其他拥有者
    if (targetMember.role === Role.OWNER && newRole !== Role.OWNER) {
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: Role.OWNER },
      });
      if (owners === 1 && targetMember.userId === currentUserId) {
        throw new BadRequestException(
          'Cannot demote the last owner of the team.',
        );
      } else if (owners === 1 && targetMember.userId !== currentUserId) {
        throw new BadRequestException(
          'Only the owner can demote themselves if there are other owners.',
        );
      }
    }

    // 更新成员角色
    return this.prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role: newRole },
    });
  }

  /**
   * 移除团队成员
   * @param teamId 团队 ID
   * @param memberId 被移除成员 ID
   * @param currentUserId 当前操作用户 ID
   * @returns 移除结果
   */
  // MARK: - 移除团队成员
  async removeMember(teamId: string, memberId: string, currentUserId: string) {
    // 检查当前操作用户是否是团队拥有者或管理员
    const currentUserMembership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: currentUserId } },
    });

    if (
      !currentUserMembership ||
      (currentUserMembership.role !== Role.OWNER &&
        currentUserMembership.role !== Role.ADMIN)
    ) {
      throw new BadRequestException(
        'You are not authorized to remove members.',
      );
    }

    // 检查目标成员是否存在于该团队
    const targetMember = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: memberId } },
    });

    if (!targetMember) {
      throw new NotFoundException('Member not found in this team.');
    }

    // 拥有者不能被移除，除非是拥有者自己操作且团队有其他拥有者
    if (targetMember.role === Role.OWNER) {
      const owners = await this.prisma.teamMember.count({
        where: { teamId, role: Role.OWNER },
      });
      if (owners === 1) {
        throw new BadRequestException(
          'Cannot remove the last owner of the team.',
        );
      }
    }

    // 移除成员
    await this.prisma.teamMember.delete({
      where: { id: targetMember.id },
    });

    return { message: 'Member removed successfully.' };
  }

  // MARK: - 获取团队成员
  async getTeamMembers(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: true,
      },
    });
  }

  // MARK: - 根据用户ID获取团队成员
  async findTeamMemberByUserId(userId: string) {
    return this.prisma.teamMember.findFirst({
      where: { userId: userId },
    });
  }

  // MARK: - 获取团队工作负载
  async getTeamWorkload(teamId: string, userId: string) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId },
    });

    if (!membership) {
      throw new NotFoundException(
        'Not a member of this team or team not found',
      );
    }

    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
    });

    return Promise.all(
      members.map(async (member) => {
        const [todoCount, inProgressCount, blockedCount, overdueCount] =
          await Promise.all([
            this.prisma.issue.count({
              where: { directAssigneeId: member.id, status: 'TODO' },
            }),
            this.prisma.issue.count({
              where: { directAssigneeId: member.id, status: 'IN_PROGRESS' },
            }),
            this.prisma.issue.count({
              where: { directAssigneeId: member.id, status: 'BLOCKED' },
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
  }
}
