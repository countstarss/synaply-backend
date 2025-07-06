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

  // MARK: 创建项目
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

  // MARK: 获取项目列表
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

  // MARK: 获取项目详情
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

  // MARK: 更新项目
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

  // MARK: 删除项目
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

  // MARK: 根据ID获取项目
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
