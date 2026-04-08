import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

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
  async getTasks(@Req() req, @Param('workspaceId') workspaceId: string) {
    return this.taskService.getTasksByWorkspace(req.user.sub, workspaceId);
  }

  /**
   * 更新任务
   */
  @Patch(':taskId')
  async updateTask(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.updateTask(req.user.sub, workspaceId, taskId, dto);
  }

  /**
   * 删除任务
   */
  @Delete(':taskId')
  async deleteTask(
    @Req() req,
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.taskService.deleteTask(req.user.sub, workspaceId, taskId);
  }
}
