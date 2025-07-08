import {
  Controller,
  Get,
  Post,
  Body,
  // Patch,
  Param,
  // Delete,
  Req,
  // HttpCode,
  // HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
// import { UpdateIssueDto } from './dto/update-issue.dto';
// import { CreateCommentDto } from './dto/create-comment.dto';
// import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';

@ApiTags('issues')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/issues')
@UseGuards(SupabaseAuthGuard)
export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  /**
   * MARK: - 创建任务
   * POST /workspaces/:workspaceId/issues
   * @summary 创建新的任务
   * @description 在指定工作空间下创建新的任务。
   * @param workspaceId 工作空间 ID
   * @param createIssueDto 创建任务的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的任务对象
   */
  @Post()
  @ApiOperation({ summary: '创建任务' })
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
   * MARK: - 获取任务列表
   * GET /workspaces/:workspaceId/issues
   * @summary 获取指定工作空间下的所有任务
   * @description 获取当前用户在指定工作空间下可见的所有任务列表，支持按项目过滤。
   * @param workspaceId 工作空间 ID
   * @param req 请求对象，包含当前用户 ID
   * @param projectId 可选的项目 ID
   * @returns 任务列表
   */
  @Get()
  @ApiOperation({ summary: '获取任务列表' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query('projectId') projectId?: string,
  ) {
    const userId = req.user?.sub;
    return this.issueService.findAll(workspaceId, userId, projectId);
  }
}
