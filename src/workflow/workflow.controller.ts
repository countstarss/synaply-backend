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
  UseGuards,
  Req,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('workflows')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/workflows')
@UseGuards(SupabaseAuthGuard)
export class WorkflowController {
  constructor(private readonly workflowsService: WorkflowService) {}

  // MARK: 创建工作流
  @Post()
  @ApiOperation({ summary: '创建工作流' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.workflowsService.create(workspaceId, createWorkflowDto, userId);
  }

  // MARK: 获取工作流列表
  @Get()
  @ApiOperation({ summary: '获取工作流列表' })
  findAll(@Param('workspaceId') workspaceId: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.findAll(workspaceId, userId);
  }

  // MARK: 获取工作流详情
  @Get(':id')
  @ApiOperation({ summary: '获取工作流详情' })
  findOne(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.findOne(id, userId);
  }

  // MARK: 更新工作流
  @Patch(':id')
  @ApiOperation({ summary: '更新工作流' })
  update(
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.workflowsService.update(id, updateWorkflowDto, userId);
  }

  // MARK: 删除工作流
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful deletion
  @ApiOperation({ summary: '删除工作流' })
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.remove(id, userId);
  }

  // MARK: 发布工作流
  @Post(':id/publish')
  @ApiOperation({ summary: '发布工作流' })
  publish(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.publish(id, userId);
  }
}
