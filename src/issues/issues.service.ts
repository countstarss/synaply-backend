
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { IssuePriority, IssueStatus } from '@prisma/client';

@Injectable()
export class IssuesService {
  constructor(private readonly prisma: PrismaService) {}

  // MARK: - 创建任务
  async create(creatorId: string, createIssueDto: CreateIssueDto) {
    const { workflowId, currentStepId, directAssigneeId, workspaceId, title, description, dueDate, startDate, priority, parentTaskId } = createIssueDto;

    if (workflowId && directAssigneeId) {
      throw new BadRequestException('Cannot assign both a workflow and a direct assignee.');
    }

    if (workflowId && !currentStepId) {
      throw new BadRequestException('currentStepId is required when workflowId is provided.');
    }

    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          title,
          description,
          workspace: {
            connect: { id: workspaceId },
          },
          creator: {
            connect: { id: creatorId },
          },
          status: IssueStatus.TODO,
          priority: priority || IssuePriority.NORMAL,
          dueDate,
          startDate,
          workflow: workflowId ? { connect: { id: workflowId } } : undefined,
          currentStep: currentStepId ? { connect: { id: currentStepId } } : undefined,
          directAssignee: directAssigneeId ? { connect: { id: directAssigneeId } } : undefined,
          parentTask: parentTaskId ? { connect: { id: parentTaskId } } : undefined,
        },
      });

      await tx.issueActivity.create({
        data: {
          issue: { connect: { id: issue.id } },
          actor: { connect: { id: creatorId } },
          toStepName: 'Created',
          comment: 'Issue created.',
        },
      });

      return issue;
    });
  }

  // MARK: - 获取所有任务
  async findAll(workspaceId: string) {
    return this.prisma.issue.findMany({
      where: { workspaceId },
      include: {
        creator: { include: { user: true } },
        directAssignee: { include: { user: true } },
        workflow: true,
        currentStep: true,
        parentTask: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // MARK: - 获取单个任务
  async findOne(id: string) {
    const issue = await this.prisma.issue.findUnique({
      where: { id },
      include: {
        creator: { include: { user: true } },
        directAssignee: { include: { user: true } },
        workflow: true,
        currentStep: true,
        parentTask: true,
        subtasks: true,
        comments: { include: { author: { include: { user: true } } } },
        activities: { orderBy: { createdAt: 'asc' } },
        blockingIssues: { include: { blockerIssue: true } },
        dependsOnIssues: { include: { dependsOnIssue: true } },
      },
    });

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }
    return issue;
  }

  // MARK: - 更新任务
  async update(id: string, updateIssueDto: UpdateIssueDto) {
    const { status, priority, dueDate, startDate, currentStepId, title, description, directAssigneeId } = updateIssueDto;

    const existingIssue = await this.prisma.issue.findUnique({
      where: { id },
      include: { currentStep: true },
    });

    if (!existingIssue) {
      throw new NotFoundException(`Issue with ID ${id} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedIssue = await tx.issue.update({
        where: { id },
        data: {
          title: title ?? existingIssue.title,
          description: description ?? existingIssue.description,
          status: status ?? existingIssue.status,
          priority: priority ?? existingIssue.priority,
          dueDate: dueDate ?? existingIssue.dueDate,
          startDate: startDate ?? existingIssue.startDate,
          currentStep: currentStepId ? { connect: { id: currentStepId } } : undefined,
          directAssignee: directAssigneeId ? { connect: { id: directAssigneeId } } : undefined,
        },
      });

      // Record activity for status or step changes
      if (status && status !== existingIssue.status) {
        await tx.issueActivity.create({
          data: {
            issue: { connect: { id: updatedIssue.id } },
            actor: { connect: { id: updatedIssue.creatorId } }, // Assuming creator is the actor for now
            fromStepName: existingIssue.status,
            toStepName: status,
            comment: `Status changed from ${existingIssue.status} to ${status}.`,
          },
        });
      }

      if (currentStepId && currentStepId !== existingIssue.currentStepId) {
        const newStep = await tx.workflowStep.findUnique({ where: { id: currentStepId } });
        await tx.issueActivity.create({
          data: {
            issue: { connect: { id: updatedIssue.id } },
            actor: { connect: { id: updatedIssue.creatorId } }, // Assuming creator is the actor for now
            fromStepName: existingIssue.currentStep?.name || 'N/A',
            toStepName: newStep?.name || 'N/A',
            comment: `Moved to step: ${newStep?.name || 'N/A'}.`,
          },
        });
      }

      return updatedIssue;
    });
  }

  // MARK: - 删除任务
  async remove(id: string) {
    // Delete associated comments
    await this.prisma.comment.deleteMany({
      where: { issueId: id },
    });

    // Delete associated activities
    await this.prisma.issueActivity.deleteMany({
      where: { issueId: id },
    });

    // Delete associated dependencies (where this issue is either blocker or dependsOn)
    await this.prisma.issueDependency.deleteMany({
      where: {
        OR: [
          { blockerIssueId: id },
          { dependsOnIssueId: id },
        ],
      },
    });

    // Finally, delete the issue itself
    return this.prisma.issue.delete({
      where: { id },
    });
  }

  // MARK: - 添加评论
  async addComment(issueId: string, authorId: string, createCommentDto: CreateCommentDto) {
    const { content } = createCommentDto;
    return this.prisma.comment.create({
      data: {
        content,
        issue: { connect: { id: issueId } },
        author: { connect: { id: authorId } },
      },
    });
  }

  // MARK: - 添加依赖
  async addDependency(issueId: string, createIssueDependencyDto: CreateIssueDependencyDto) {
    const { dependsOnIssueId } = createIssueDependencyDto;

    // Check if both issues exist
    const [issue, dependsOnIssue] = await this.prisma.$transaction([
      this.prisma.issue.findUnique({ where: { id: issueId } }),
      this.prisma.issue.findUnique({ where: { id: dependsOnIssueId } }),
    ]);

    if (!issue) {
      throw new NotFoundException(`Issue with ID ${issueId} not found`);
    }
    if (!dependsOnIssue) {
      throw new NotFoundException(`DependsOnIssue with ID ${dependsOnIssueId} not found`);
    }

    // Prevent self-dependency
    if (issueId === dependsOnIssueId) {
      throw new BadRequestException('An issue cannot depend on itself.');
    }

    // Prevent circular dependency (simple check for direct circularity)
    const existingDependency = await this.prisma.issueDependency.findUnique({
      where: { blockerIssueId_dependsOnIssueId: { blockerIssueId: dependsOnIssueId, dependsOnIssueId: issueId } },
    });
    if (existingDependency) {
      throw new BadRequestException('Circular dependency detected.');
    }

    return this.prisma.issueDependency.create({
      data: {
        blockerIssue: { connect: { id: issueId } },
        dependsOnIssue: { connect: { id: dependsOnIssueId } },
      },
    });
  }

  // MARK: - 移除依赖
  async removeDependency(issueId: string, dependsOnIssueId: string) {
    // Check if the dependency exists
    const dependency = await this.prisma.issueDependency.findUnique({
      where: { blockerIssueId_dependsOnIssueId: { blockerIssueId: issueId, dependsOnIssueId: dependsOnIssueId } },
    });

    if (!dependency) {
      throw new NotFoundException(`Dependency from ${issueId} to ${dependsOnIssueId} not found.`);
    }

    return this.prisma.issueDependency.delete({
      where: { blockerIssueId_dependsOnIssueId: { blockerIssueId: issueId, dependsOnIssueId: dependsOnIssueId } },
    });
  }
}
