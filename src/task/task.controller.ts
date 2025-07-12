import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';

@UseGuards(SupabaseAuthGuard)
@Controller('workspaces/:workspaceId/tasks')
export class TaskController {
  constructor(private taskService: TaskService) {}

  /**
   * 添加任务到 Calendar
   */
  @Post()
  async createTask(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateTaskDto,
  ) {
    const userId = req.user.sub as string;
    return this.taskService.createTask(userId, workspaceId, dto);
  }

  /**
   * 获取指定工作空间的全部任务
   */
  @Get()
  async getTasks(@Param('workspaceId') workspaceId: string) {
    return this.taskService.getTasksByWorkspace(workspaceId);
  }
}
