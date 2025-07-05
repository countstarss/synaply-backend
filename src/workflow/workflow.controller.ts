import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Controller('workspaces/:workspaceId/workflows')
export class WorkflowController {
  constructor(private readonly workflowsService: WorkflowService) {}

  // MARK: 创建工作流
  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowsService.create(workspaceId, createWorkflowDto);
  }

  // MARK: 获取工作流列表
  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.workflowsService.findAll(workspaceId);
  }

  // MARK: 获取工作流详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflowsService.findOne(id);
  }

  // MARK: 更新工作流
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(id, updateWorkflowDto);
  }

  // MARK: 删除工作流
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful deletion
  remove(@Param('id') id: string) {
    return this.workflowsService.remove(id);
  }

  // MARK: 发布工作流
  @Post(':id/publish')
  publish(@Param('id') id: string) {
    return this.workflowsService.publish(id);
  }
}
