import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateWorkflowIssueDto } from './dto/create-workflow-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';

@ApiTags('issues')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/issues')
@UseGuards(SupabaseAuthGuard)
export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  /**
   * MARK: - 创建任务
   * POST /workspaces/:workspaceId/issues
   */
  @Post('/direct-assignee')
  @ApiOperation({ summary: '创建任务 (简化版)' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createIssueDto: CreateIssueDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.create(userId, {
      ...createIssueDto,
      workspaceId,
    });
  }

  /**
   * MARK: - 创建基于Workflow的任务
   * POST /workspaces/:workspaceId/issues
   */
  @Post('/workflow')
  @ApiOperation({ summary: '创建基于Workflow的任务 (简化版)' })
  createWorkflowIssue(
    @Param('workspaceId') workspaceId: string,
    @Body() createWorkflowIssueDto: CreateWorkflowIssueDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.createWorkflowIssue(userId, {
      ...createWorkflowIssueDto,
      workspaceId,
    });
  }

  /**
   * MARK: - 获取任务列表
   * GET /workspaces/:workspaceId/issues
   */
  @Get()
  @ApiOperation({ summary: '获取任务列表 (简化版)' })
  findAll(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.findAll(workspaceId, userId);
  }

  /**
   * MARK: - 更新 Issue
   * PATCH /workspaces/:workspaceId/issues/:id
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新任务 (局部字段)' })
  updateIssue(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() updateIssueDto: UpdateIssueDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.update(userId, workspaceId, id, updateIssueDto);
  }

  /**
   * MARK: - 删除任务
   * DELETE /workspaces/:workspaceId/issues/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除任务' })
  removeIssue(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.remove(userId, workspaceId, id);
  }
}
