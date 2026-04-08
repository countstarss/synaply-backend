import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarModule } from '../calendar/calendar.module';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, CalendarModule, AuthModule, CommonModule],
  providers: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
