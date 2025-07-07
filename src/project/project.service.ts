import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, VisibilityType } from '@prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class ProjectService {
  constructor(
    private prisma: PrismaService,
    private teamMemberService: TeamMemberService,
    private permissionService: PermissionService,
  ) {}

  /**
   * MARK: - 创建项目
   * @description
   * 思考过程:
   * 1. 目标: 在指定工作空间下创建一个新的项目。
   * 2. 权限: 验证用户对工作空间的访问权限，并确保在团队工作空间中只有 OWNER 或 ADMIN 可以创建项目。
   * 3. 关联: 将项目与工作空间和创建者 (TeamMember) 关联起来。
   * 4. 默认值: `visibility` 字段可以有默认值。
   * @param createProjectDto 创建项目的数据
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 创建的项目对象
   */
  async create(
    createProjectDto: CreateProjectDto,
    workspaceId: string,
    userId: string,
  ) {
    const {
      name,
      description,
      visibility = VisibilityType.PRIVATE,
    } = createProjectDto;

    // 验证工作空间访问权限并获取TeamMember ID
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 检查创建权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    if (workspace.type === 'TEAM') {
      const member = workspace.team.members.find(
        (m: any) => m.userId === userId,
      );
      if (!member || member.role === Role.MEMBER) {
        throw new ForbiddenException('只有 OWNER 或 ADMIN 可以创建项目');
      }
    }

    // 创建项目
    return this.prisma.project.create({
      data: {
        name,
        description,
        workspaceId,
        creatorId: teamMemberId,
        visibility,
      },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }

  /**
   * MARK: - 获取项目列表
   * @description
   * 思考过程:
   * 1. 目标: 获取指定工作空间下，当前用户有权限查看的所有项目列表。
   * 2. 权限: 首先验证用户对工作空间的访问权限。然后，对于每个项目，使用 `PermissionService` 检查用户是否有读取权限。
   * 3. 关联: 包含创建者和工作空间信息。
   * 4. 排序: 默认按创建时间倒序排列。
   * @param workspaceId 工作空间 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 项目列表
   */
  async findAll(workspaceId: string, userId: string) {
    // 验证用户有权访问该工作空间
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 获取用户有权限查看的项目
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: {
        creator: {
          include: { user: true },
        },
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

    // 过滤用户有权限查看的项目
    const filteredProjects = [];
    for (const project of projects) {
      const hasPermission =
        await this.permissionService.checkResourcePermission(
          userId,
          'project',
          project.id,
          'read',
        );
      if (hasPermission) {
        filteredProjects.push(project);
      }
    }

    return filteredProjects;
  }

  /**
   * MARK: - 获取项目详情
   * @description
   * 思考过程:
   * 1. 目标: 获取单个项目的详细信息。
   * 2. 权限: 验证用户对该项目的读取权限。
   * 3. 验证: 如果项目不存在，抛出 `NotFoundException`。
   * 4. 关联: 包含创建者和工作空间信息。
   * @param id 项目 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 项目对象
   */
  async findOne(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      id,
      'read',
    );

    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: {
          include: {
            team: {
              include: {
                members: {
                  include: { user: true },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  /**
   * MARK: - 更新项目
   * @description
   * 思考过程:
   * 1. 目标: 更新指定项目的各项信息。
   * 2. 权限: 验证用户对该项目的写入权限。
   * @param id 项目 ID
   * @param updateProjectDto 更新项目的数据
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 更新后的项目对象
   */
  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      id,
      'write',
    );

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }

  /**
   * MARK: - 删除项目
   * @description
   * 思考过程:
   * 1. 目标: 删除指定项目。
   * 2. 权限: 验证用户对该项目的删除权限。
   * 3. 业务逻辑: 检查项目是否有关联的任务，如果有，则不允许删除，以维护数据完整性。
   * @param id 项目 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   */
  async remove(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      id,
      'delete',
    );

    // 检查是否有关联的 issues
    const issueCount = await this.prisma.issue.count({
      where: { projectId: id },
    });

    if (issueCount > 0) {
      throw new BadRequestException(
        `无法删除项目，还有 ${issueCount} 个关联的任务`,
      );
    }

    return this.prisma.project.delete({
      where: { id },
    });
  }

  /**
   * MARK: - 根据 ID 获取项目
   * @description
   * 思考过程:
   * 1. 目标: 根据项目 ID 获取项目详细信息，并验证用户权限。
   * 2. 权限: 验证用户对该项目的读取权限。
   * 3. 验证: 如果项目不存在，抛出 `NotFoundException`。
   * 4. 关联: 包含创建者和工作空间信息。
   * @param projectId 项目 ID
   * @param userId 当前认证用户 ID (Supabase User ID)
   * @returns 项目对象
   */
  async findProjectById(projectId: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'project',
      projectId,
      'read',
    );

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }
}
