import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowStatus, VisibilityType, Role } from '@prisma/client';
import { TeamMemberService } from '../common/services/team-member.service';
import { PermissionService } from '../common/services/permission.service';

@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly permissionService: PermissionService,
  ) {}

  // MARK: - 创建工作流
  async create(
    workspaceId: string,
    createWorkflowDto: CreateWorkflowDto,
    userId: string,
  ) {
    const { name, visibility = VisibilityType.PRIVATE } = createWorkflowDto;

    // 验证工作空间访问权限并获取TeamMember ID
    const { workspace, teamMemberId } =
      await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 检查创建权限：个人工作空间或团队工作空间的 OWNER/ADMIN
    if (workspace.type === 'TEAM') {
      const member = workspace.team.members.find(
        (m: any) => m.userId === userId,
      );
      if (!member || member.role === Role.MEMBER) {
        throw new ForbiddenException('只有 OWNER 或 ADMIN 可以创建工作流');
      }
    }

    return this.prisma.workflow.create({
      data: {
        name,
        visibility,
        workspace: {
          connect: { id: workspaceId },
        },
        creator: {
          connect: { id: teamMemberId },
        },
      },
      include: {
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }

  // MARK: - 获取工作流列表
  async findAll(workspaceId: string, userId: string) {
    // 验证用户有权访问该工作空间
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    // 获取用户有权限查看的工作流
    const workflows = await this.prisma.workflow.findMany({
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

    // 过滤用户有权限查看的工作流
    const filteredWorkflows = [];
    for (const workflow of workflows) {
      const hasPermission =
        await this.permissionService.checkResourcePermission(
          userId,
          'workflow',
          workflow.id,
          'read',
        );
      if (hasPermission) {
        filteredWorkflows.push(workflow);
      }
    }

    return filteredWorkflows;
  }

  // MARK: - 获取工作流
  async findOne(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'read',
    );

    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { order: 'asc' } },
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    return workflow;
  }

  // MARK: - 更新工作流
  async update(
    id: string,
    updateWorkflowDto: UpdateWorkflowDto,
    userId: string,
  ) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'write',
    );

    const { name, status, steps } = updateWorkflowDto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Workflow (name and status)
      await tx.workflow.update({
        where: { id },
        data: {
          name,
          status,
        },
      });

      // 2. Handle Workflow Steps
      if (steps !== undefined) {
        // Get existing steps for this workflow
        const existingSteps = await tx.workflowStep.findMany({
          where: { workflowId: id },
          select: { id: true },
        });
        const existingStepIds = new Set(existingSteps.map((s) => s.id));

        const stepsToCreate = [];
        const stepsToUpdate = [];
        const stepIdsToKeep = new Set();

        for (const stepDto of steps) {
          if (stepDto.id) {
            // This is an existing step to update
            stepsToUpdate.push(stepDto);
            stepIdsToKeep.add(stepDto.id);
          } else {
            // This is a new step to create
            stepsToCreate.push(stepDto);
          }
        }

        // Steps to delete (those existing but not in the update DTO)
        const stepsToDeleteIds = [...existingStepIds].filter(
          (stepId) => !stepIdsToKeep.has(stepId),
        );

        // Perform deletions
        if (stepsToDeleteIds.length > 0) {
          await tx.workflowStep.deleteMany({
            where: {
              id: {
                in: stepsToDeleteIds,
              },
            },
          });
        }

        // Perform updates
        for (const stepDto of stepsToUpdate) {
          await tx.workflowStep.update({
            where: { id: stepDto.id },
            data: {
              name: stepDto.name,
              description: stepDto.description,
              order: stepDto.order,
              assignee: stepDto.assigneeId
                ? {
                    connect: { id: stepDto.assigneeId },
                  }
                : { disconnect: true },
            },
          });
        }

        // Perform creations
        if (stepsToCreate.length > 0) {
          await tx.workflowStep.createMany({
            data: stepsToCreate.map((stepDto) => ({
              name: stepDto.name,
              description: stepDto.description,
              order: stepDto.order,
              assigneeId: stepDto.assigneeId,
              workflowId: id, // Link to the current workflow
            })),
          });
        }
      }

      // Return the updated workflow with its current steps
      return tx.workflow.findUnique({
        where: { id },
        include: {
          steps: { orderBy: { order: 'asc' } },
          creator: {
            include: { user: true },
          },
          workspace: true,
        },
      });
    });
  }

  // MARK: - 删除工作流
  async remove(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'delete',
    );

    // First, delete all associated workflow steps
    await this.prisma.workflowStep.deleteMany({
      where: { workflowId: id },
    });

    // Then, delete the workflow itself
    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  // MARK: - 发布工作流
  async publish(id: string, userId: string) {
    // 验证权限
    await this.permissionService.validateResourcePermission(
      userId,
      'workflow',
      id,
      'write',
    );

    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundException(`工作流 ${id} 不存在`);
    }

    if (workflow.steps.length === 0) {
      throw new ForbiddenException('不能发布没有步骤的工作流');
    }

    return this.prisma.workflow.update({
      where: { id },
      data: { status: WorkflowStatus.PUBLISHED },
      include: {
        steps: { orderBy: { order: 'asc' } },
        creator: {
          include: { user: true },
        },
        workspace: true,
      },
    });
  }
}
