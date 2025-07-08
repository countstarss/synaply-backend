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

  /**
   * MARK: - 创建工作流
   * POST /workspaces/:workspaceId/workflows
   * @summary 创建新的工作流
   * @description 在指定工作空间下创建新的工作流。
   * @param workspaceId 工作空间 ID
   * @param createWorkflowDto 创建工作流的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的工作流对象
   */
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

  /**
   * MARK: - 获取工作流列表
   * GET /workspaces/:workspaceId/workflows
   * @summary 获取指定工作空间下的所有工作流
   * @description 获取当前用户在指定工作空间下可见的所有工作流列表。
   * @param workspaceId 工作空间 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 工作流列表
   */
  @Get()
  @ApiOperation({ summary: '获取工作流列表' })
  findAll(@Param('workspaceId') workspaceId: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.findAll(workspaceId, userId);
  }

  /**
   * MARK: - 获取工作流详情
   * GET /workspaces/:workspaceId/workflows/:id
   * @summary 获取单个工作流的详细信息
   * @description 获取指定 ID 的工作流的详细信息。
   * @param id 工作流 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 工作流对象
   */
  @Get(':id')
  @ApiOperation({ summary: '获取工作流详情' })
  findOne(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.findOne(id, userId);
  }

  /**
   * MARK: - 更新工作流
   * PATCH /workspaces/:workspaceId/workflows/:id
   * @summary 更新指定工作流
   * @description 更新指定 ID 的工作流的名称、描述或JSON数据。
   * @param id 工作流 ID
   * @param updateWorkflowDto 更新工作流的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 更新后的工作流对象
   */
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

  /**
   * MARK: - 删除工作流
   * DELETE /workspaces/:workspaceId/workflows/:id
   * @summary 删除指定工作流
   * @description 删除指定 ID 的工作流。
   * @param id 工作流 ID
   * @param req 请求对象，包含当前用户 ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 204 No Content for successful deletion
  @ApiOperation({ summary: '删除工作流' })
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.remove(id, userId);
  }

  /**
   * MARK: - 发布工作流
   * POST /workspaces/:workspaceId/workflows/:id/publish
   * @summary 发布指定工作流
   * @description 将草稿状态的工作流发布为已发布状态。
   * @param id 工作流 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 发布后的工作流对象
   */
  @Post(':id/publish')
  @ApiOperation({ summary: '发布工作流' })
  publish(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub;
    return this.workflowsService.publish(id, userId);
  }
}
