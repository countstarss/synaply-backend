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
   * MARK: - 创建团队
   * @description
   * 思考过程:
   * 1. 目标: 创建一个新的团队，并自动为该团队创建关联的工作空间，同时将创建者设置为团队的 OWNER。
   * 2. 权限: 任何认证用户都可以创建团队。
   * 3. 验证: 检查团队名称是否已存在，避免重复创建。
   * 4. 事务性: 团队、团队成员和工作空间的创建应是原子操作，确保数据一致性。
   * 5. 关联: 使用 Prisma 的嵌套写入功能，一次性创建团队、成员和工作空间。
   * @param createTeamDto 团队创建 DTO
   * @param ownerId 团队拥有者 ID (Supabase User ID)
   * @returns 创建的团队对象
   */
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
   * MARK: - 邀请成员加入团队
   * @description
   * 思考过程:
   * 1. 目标: 将一个用户邀请到指定团队，并将其添加为团队成员。
   * 2. 权限: 只有团队的 OWNER 或 ADMIN 才能邀请成员。
   * 3. 验证: 检查邀请者权限；检查被邀请用户是否存在；检查用户是否已是团队成员。
   * 4. 角色: 新成员默认角色为 MEMBER。
   * @param teamId 团队 ID
   * @param inviteMemberDto 邀请成员 DTO
   * @param inviterId 邀请者 ID (Supabase User ID)
   * @returns 邀请结果
   */
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
   * MARK: - 获取团队详情
   * @description
   * 思考过程:
   * 1. 目标: 获取指定团队的详细信息，包括其所有成员（及成员的用户信息）和关联的工作空间。
   * 2. 验证: 检查团队是否存在。
   * 3. 关联: 使用 `include` 加载 `members` 和 `workspace` 关系，并通过嵌套 `include` 加载成员的用户信息。
   * @param teamId 团队 ID
   * @returns 团队对象
   */
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
   * MARK: - 获取用户所属的所有团队
   * @description
   * 思考过程:
   * 1. 目标: 获取某个用户作为成员所属的所有团队列表。
   * 2. 策略: 通过 `teamMember` 表查询该用户的所有成员关系，然后通过 `include` 加载关联的 `team` 信息。
   * 3. 转换: 将 `teamMember` 数组映射为 `team` 数组。
   * @param userId 用户 ID (Supabase User ID)
   * @returns 团队列表
   */
  async getUserTeams(userId: string) {
    const teamMemberships = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: { workspace: true } } },
    });
    return teamMemberships.map((tm) => tm.team);
  }

  /**
   * MARK: - 更新团队成员角色
   * @description
   * 思考过程:
   * 1. 目标: 更新团队中某个成员的角色。
   * 2. 权限: 只有团队的 OWNER 或 ADMIN 才能执行此操作。
   * 3. 验证: 检查操作者权限；检查目标成员是否存在于该团队。
   * 4. 业务逻辑: 拥有者不能被随意降级，特别是当他是团队中唯一的拥有者时。
   * @param teamId 团队 ID
   * @param memberId 成员 ID (Supabase User ID)
   * @param newRole 新角色
   * @param currentUserId 当前操作用户 ID (Supabase User ID)
   * @returns 更新后的团队成员
   */
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
   * MARK: - 移除团队成员
   * @description
   * 思考过程:
   * 1. 目标: 从团队中移除一个成员。
   * 2. 权限: 只有团队的 OWNER 或 ADMIN 才能执行此操作。
   * 3. 验证: 检查操作者权限；检查目标成员是否存在于该团队。
   * 4. 业务逻辑: 拥有者不能被随意移除，特别是当他是团队中唯一的拥有者时。
   * @param teamId 团队 ID
   * @param memberId 被移除成员 ID (Supabase User ID)
   * @param currentUserId 当前操作用户 ID (Supabase User ID)
   * @returns 移除结果
   */
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

  /**
   * MARK: - 获取团队成员列表
   * @description
   * 思考过程:
   * 1. 目标: 获取指定团队的所有成员信息，包括其关联的用户详情。
   * 2. 策略: 使用 `findMany` 查询 `teamMember`，并通过 `include` 加载 `user` 关系。
   * @param teamId 团队 ID
   * @returns 团队成员列表
   */
  async getTeamMembers(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: { teamId },
      include: {
        user: true,
      },
    });
  }

  /**
   * MARK: - 根据用户 ID 获取团队成员
   * @description
   * 思考过程:
   * 1. 目标: 根据 Supabase 的用户 ID (userId) 查找对应的团队成员 (TeamMember) 记录。
   * 2. 策略: 使用 `findFirst`，因为一个用户在同一个团队中只会有一个 `TeamMember` 记录，但一个用户可能在多个团队中都有 `TeamMember` 记录。这里我们只返回找到的第一个。
   * 3. 考虑: 如果一个用户属于多个团队，并且需要特定团队的 `TeamMember`，则需要额外的 `teamId` 参数。
   * @param userId 用户 ID (Supabase User ID)
   * @returns 团队成员对象或 null
   */
  async findTeamMemberByUserId(userId: string) {
    return this.prisma.teamMember.findFirst({
      where: { userId: userId },
    });
  }

  /**
   * MARK: - 获取团队工作负载
   * @description
   * 思考过程:
   * 1. 目标: 获取团队中每个成员的任务负载统计（待办、进行中、阻塞、逾期）。
   * 2. 权限: 确保调用者是该团队的成员。
   * 3. 策略: 首先验证调用者是否是团队成员；然后获取团队所有成员；最后为每个成员并行查询其不同状态的任务数量。
   * 4. 性能: 使用 `Promise.all` 并行执行多个数据库查询，提高效率。
   * @param teamId 团队 ID
   * @param userId 调用者用户 ID (Supabase User ID)
   * @returns 团队成员工作负载统计列表
   */
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
