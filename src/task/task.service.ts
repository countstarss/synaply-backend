import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from '../calendar/calendar.service';
import { CreateTaskDto } from './dto/create-task.dto';
// import { TaskStatus } from '../../prisma/generated/prisma/client';

@Injectable()
export class TaskService {
  constructor(
    private prisma: PrismaService,
    private calendarService: CalendarService,
  ) {}

  /**
   * 创建任务并关联到对应工作空间的 Calendar
   */
  async createTask(userId: string, workspaceId: string, dto: CreateTaskDto) {
    const calendar =
      await this.calendarService.getOrCreateCalendar(workspaceId);

    // @ts-ignore
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: 'PENDING', // 使用字符串，Prisma 生成类型后可替换为枚举
        calendar: { connect: { id: calendar.id } },
        // TODO: createdById 可根据业务需求进一步完善
        // createdById: userId,
      },
    });
  }

  /**
   * 根据工作空间获取所有任务
   */
  async getTasksByWorkspace(workspaceId: string) {
    // @ts-ignore
    return this.prisma.task.findMany({
      where: {
        calendar: {
          workspaceId,
        },
      },
    });
  }

  /**
   * 更新任务
   */
  async updateTask(
    workspaceId: string,
    taskId: string,
    dto: Partial<CreateTaskDto>,
  ) {
    // @ts-ignore
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
      },
    });
  }

  /**
   * 删除任务
   */
  async deleteTask(workspaceId: string, taskId: string) {
    // @ts-ignore
    return this.prisma.task.delete({
      where: {
        id: taskId,
      },
    });
  }
}
