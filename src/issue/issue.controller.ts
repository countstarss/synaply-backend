import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
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

  /**
   * MARK: - 获取任务详情
   * GET /workspaces/:workspaceId/issues/:id
   * @summary 获取单个任务的详细信息
   * @description 获取指定 ID 的任务的详细信息。
   * @param id 任务 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 任务对象
   */
  @Get(':id')
  @ApiOperation({ summary: '获取任务详情' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.findOne(id, userId);
  }

  /**
   * MARK: - 更新任务
   * PATCH /workspaces/:workspaceId/issues/:id
   * @summary 更新指定任务
   * @description 更新指定 ID 的任务的各项信息。
   * @param id 任务 ID
   * @param updateIssueDto 更新任务的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 更新后的任务对象
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新任务' })
  update(
    @Param('id') id: string,
    @Body() updateIssueDto: UpdateIssueDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.update(id, updateIssueDto, userId);
  }

  /**
   * MARK: - 删除任务
   * DELETE /workspaces/:workspaceId/issues/:id
   * @summary 删除指定任务
   * @description 删除指定 ID 的任务。
   * @param id 任务 ID
   * @param req 请求对象，包含当前用户 ID
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除任务' })
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.remove(id, userId);
  }

  /**
   * MARK: - 添加评论
   * POST /workspaces/:workspaceId/issues/:issueId/comments
   * @summary 为任务添加评论
   * @description 为指定任务添加一条评论。
   * @param issueId 任务 ID
   * @param createCommentDto 评论数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的评论对象
   */
  @Post(':issueId/comments')
  @ApiOperation({ summary: '添加评论' })
  addComment(
    @Param('issueId') issueId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.addComment(issueId, userId, createCommentDto);
  }

  /**
   * MARK: - 添加依赖
   * POST /workspaces/:workspaceId/issues/:issueId/dependencies
   * @summary 为任务添加依赖
   * @description 为指定任务添加一个依赖关系。
   * @param issueId 任务 ID
   * @param createIssueDependencyDto 依赖数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的依赖对象
   */
  @Post(':issueId/dependencies')
  @ApiOperation({ summary: '添加依赖' })
  addDependency(
    @Param('issueId') issueId: string,
    @Body() createIssueDependencyDto: CreateIssueDependencyDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.addDependency(
      issueId,
      createIssueDependencyDto,
      userId,
    );
  }
}
