import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarModule } from '../calendar/calendar.module';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule, CalendarModule, AuthModule],
  providers: [TaskService],
  controllers: [TaskController],
})
export class TaskModule {}
