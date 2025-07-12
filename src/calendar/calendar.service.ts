import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取指定工作空间的 Calendar，如不存在则自动创建
   * @param workspaceId 工作空间 ID
   * @param name 可选的日历名称，默认“默认日历”
   */
  async getOrCreateCalendar(workspaceId: string, name = '默认日历') {
    // @ts-ignore
    let calendar = await this.prisma.calendar.findUnique({
      where: { workspaceId },
    });

    if (!calendar) {
      // @ts-ignore
      calendar = await this.prisma.calendar.create({
        data: {
          name,
          workspace: {
            connect: { id: workspaceId },
          },
        },
      });
    }

    return calendar;
  }
}
