import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  // MARK: 创建项目
  async create(
    createProjectDto: CreateProjectDto,
    workspaceId: string,
    userId: string,
  ) {
    const { name, description } = createProjectDto;

    // 验证工作空间存在
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('工作空间不存在');
    }

    // 检查权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    if (workspace.type === 'PERSONAL') {
      if (workspace.userId !== userId) {
        throw new ForbiddenException('无权在此工作空间创建项目');
      }
    } else {
      const member = workspace.team.members.find((m) => m.userId === userId);
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
      },
    });
  }

  // MARK: 获取项目列表
  async findAll(workspaceId: string, userId: string) {
    // 验证用户有权访问该工作空间
    await this.validateWorkspaceAccess(workspaceId, userId);

    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // MARK: 获取项目详情
  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        workspace: {
          include: {
            team: {
              include: {
                members: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    // 验证用户有权访问
    await this.validateWorkspaceAccess(project.workspaceId, userId);

    return project;
  }

  // MARK: 更新项目
  async update(id: string, updateProjectDto: UpdateProjectDto, userId: string) {
    const project = await this.findOne(id, userId);

    // 检查权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    const workspace = project.workspace;
    if (workspace.type === 'PERSONAL') {
      if (workspace.userId !== userId) {
        throw new ForbiddenException('无权修改此项目');
      }
    } else {
      const member = workspace.team.members.find((m) => m.userId === userId);
      if (!member || member.role === Role.MEMBER) {
        throw new ForbiddenException('只有 OWNER 或 ADMIN 可以修改项目');
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: updateProjectDto,
    });
  }

  // MARK: 删除项目
  async remove(id: string, userId: string) {
    const project = await this.findOne(id, userId);

    // 检查权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    const workspace = project.workspace;
    if (workspace.type === 'PERSONAL') {
      if (workspace.userId !== userId) {
        throw new ForbiddenException('无权删除此项目');
      }
    } else {
      const member = workspace.team.members.find((m) => m.userId === userId);
      if (!member || member.role === Role.MEMBER) {
        throw new ForbiddenException('只有 OWNER 或 ADMIN 可以删除项目');
      }
    }

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

  // MARK: 验证用户有权访问工作空间
  private async validateWorkspaceAccess(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        team: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('工作空间不存在');
    }

    // 个人工作空间
    if (workspace.type === 'PERSONAL' && workspace.userId !== userId) {
      throw new ForbiddenException('无权访问此工作空间');
    }

    // 团队工作空间
    if (workspace.type === 'TEAM') {
      const isMember = workspace.team.members.some((m) => m.userId === userId);
      if (!isMember) {
        throw new ForbiddenException('无权访问此工作空间');
      }
    }

    return workspace;
  }

  // MARK: 根据ID获取项目
  async findProjectById(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
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
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或无权限访问');
    }
    return project;
  }
}
