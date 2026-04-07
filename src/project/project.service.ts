import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, VisibilityType } from '../../prisma/generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  // MARK: Create
  async create(
    workspaceId: string,
    createProjectDto: CreateProjectDto,
    userId: string,
  ) {
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    this.ensureProjectManagementPermission(workspace, userId, '创建');

    const visibility =
      createProjectDto.visibility ??
      (workspace.type === 'TEAM'
        ? VisibilityType.TEAM_READONLY
        : VisibilityType.PRIVATE);

    return this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        description: createProjectDto.description,
        visibility,
        creatorId: teamMemberId,
        workspaceId,
      },
    });
  }

  // MARK: FindAll
  async findAll(workspaceId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.project.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(workspaceId: string, projectId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.findProjectOrThrow(workspaceId, projectId, {
      workspace: true,
    });
  }

  // MARK: Update
  async update(
    workspaceId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    userId: string,
  ) {
    const { workspace } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    this.ensureProjectManagementPermission(workspace, userId, '更新');
    await this.findProjectOrThrow(workspaceId, projectId);

    return this.prisma.project.update({
      where: { id: projectId },
      data: updateProjectDto,
    });
  }

  // MARK: Remove
  async remove(workspaceId: string, projectId: string, userId: string) {
    const { workspace } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    this.ensureProjectManagementPermission(workspace, userId, '删除');
    const project = await this.findProjectOrThrow(workspaceId, projectId);

    return this.prisma.$transaction(async (tx) => {
      const projectIssues = await tx.issue.findMany({
        where: { projectId },
        select: { id: true },
      });

      const issueIds = projectIssues.map((issue) => issue.id);

      if (issueIds.length > 0) {
        await tx.comment.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issueActivity.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issueStepRecord.deleteMany({
          where: {
            issueId: {
              in: issueIds,
            },
          },
        });

        await tx.issue.deleteMany({
          where: {
            id: {
              in: issueIds,
            },
          },
        });
      }

      await tx.project.delete({
        where: { id: projectId },
      });

      return {
        ...project,
        deletedIssueCount: issueIds.length,
      };
    });
  }

  private ensureProjectManagementPermission(
    workspace: any,
    userId: string,
    action: '创建' | '更新' | '删除',
  ) {
    if (workspace.type !== 'TEAM') {
      return;
    }

    const currentMember = workspace.team.members.find(
      (member: any) => member.userId === userId,
    );

    if (!currentMember || currentMember.role === Role.MEMBER) {
      throw new ForbiddenException(`只有 OWNER 或 ADMIN 可以${action}项目`);
    }
  }

  private async findProjectOrThrow(
    workspaceId: string,
    projectId: string,
    include?: { workspace?: boolean },
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        workspaceId,
      },
      include,
    });

    if (!project) {
      throw new NotFoundException(`项目 ${projectId} 不存在`);
    }

    return project;
  }
}
