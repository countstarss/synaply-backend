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
  Query,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CreateWorkflowIssueDto } from './dto/create-workflow-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateIssueStepRecordDto } from './dto/create-issue-step-record.dto';
import { CreateIssueActivityDto } from './dto/create-issue-activity.dto';
import { QueryIssueDto } from './dto/query-issue.dto';

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
   * 支持 scope、stateId、projectId、assigneeId、labelId 等过滤参数
   */
  @Get()
  @ApiOperation({ summary: '获取任务列表 (支持 scope 过滤)' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: QueryIssueDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.findAll(workspaceId, userId, query);
  }

  /**
   * MARK: - 获取单个任务
   * GET /workspaces/:workspaceId/issues/:id
   */
  @Get(':id')
  @ApiOperation({ summary: '获取单个任务详情' })
  findOne(@Param('id') id: string) {
    return this.issueService.findOne(id);
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

  /* ------------------------ Issue Step Records ------------------------ */

  // MARK: - 添加步骤记录
  @Post(':id/steps')
  @ApiOperation({ summary: '添加步骤记录' })
  addStepRecord(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: CreateIssueStepRecordDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.addStepRecord(userId, workspaceId, id, dto);
  }

  // MARK: - 获取步骤记录列表
  @Get(':id/steps')
  @ApiOperation({ summary: '步骤记录列表' })
  listStepRecords(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.listStepRecords(userId, workspaceId, id);
  }

  /* ------------------------ Issue Activities ------------------------ */

  // MARK: - 添加 Issue 活动
  @Post(':id/activities')
  @ApiOperation({ summary: '添加 Issue 活动' })
  addIssueActivity(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: CreateIssueActivityDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.addIssueActivity(userId, workspaceId, id, dto);
  }

  // MARK: - 获取活动列表
  @Get(':id/activities')
  @ApiOperation({ summary: 'Issue 活动列表' })
  listIssueActivities(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.listIssueActivities(userId, workspaceId, id);
  }
}
