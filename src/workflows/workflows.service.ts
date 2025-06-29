import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { WorkflowStatus } from '@prisma/client';

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  create(workspaceId: string, createWorkflowDto: CreateWorkflowDto) {
    const { name } = createWorkflowDto;

    return this.prisma.workflow.create({
      data: {
        name,
        workspace: {
          connect: { id: workspaceId },
        },
        // The status defaults to DRAFT as per the schema
      },
    });
  }

  async findAll(workspaceId: string) {
    return this.prisma.workflow.findMany({
      where: { workspaceId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }
    return workflow;
  }

  async update(id: string, updateWorkflowDto: UpdateWorkflowDto) {
    const { name, status, steps } = updateWorkflowDto;

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Workflow (name and status)
      const updatedWorkflow = await tx.workflow.update({
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
                : undefined,
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
        include: { steps: { orderBy: { order: 'asc' } } },
      });
    });
  }

  async remove(id: string) {
    // First, delete all associated workflow steps
    await this.prisma.workflowStep.deleteMany({
      where: { workflowId: id },
    });

    // Then, delete the workflow itself
    return this.prisma.workflow.delete({
      where: { id },
    });
  }

  async publish(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    if (workflow.steps.length === 0) {
      throw new Error('Cannot publish a workflow without any steps.');
    }

    return this.prisma.workflow.update({
      where: { id },
      data: { status: WorkflowStatus.PUBLISHED },
    });
  }
}
