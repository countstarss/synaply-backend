import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from '../calendar/calendar.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TeamMemberService } from '../common/services/team-member.service';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private calendarService: CalendarService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  private async getTaskInWorkspaceOrThrow(workspaceId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        calendar: {
          workspaceId,
        },
      },
      include: {
        calendar: true,
        createdBy: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(
        `Task ${taskId} not found in workspace ${workspaceId}`,
      );
    }

    return task;
  }

  /**
   * 创建任务并关联到对应工作空间的 Calendar
   */
  async createTask(userId: string, workspaceId: string, dto: CreateTaskDto) {
    const { teamMemberId } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );
    const calendar =
      await this.calendarService.getOrCreateCalendar(workspaceId);

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: dto.status ?? 'PENDING',
        calendar: { connect: { id: calendar.id } },
        createdBy: { connect: { id: teamMemberId } },
      },
      include: {
        calendar: true,
        createdBy: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * 根据工作空间获取所有任务
   */
  async getTasksByWorkspace(userId: string, workspaceId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return this.prisma.task.findMany({
      where: {
        calendar: {
          workspaceId,
        },
      },
      include: {
        calendar: true,
        createdBy: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 更新任务
   */
  async updateTask(
    userId: string,
    workspaceId: string,
    taskId: string,
    dto: Partial<CreateTaskDto>,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.getTaskInWorkspaceOrThrow(workspaceId, taskId);

    return this.prisma.task.update({
      where: {
        id: taskId,
      },
      data: {
        ...dto,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
      include: {
        calendar: true,
        createdBy: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(userId: string, workspaceId: string, taskId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);
    await this.getTaskInWorkspaceOrThrow(workspaceId, taskId);

    return this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });
  }
}
