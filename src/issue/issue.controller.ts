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

  // MARK: 创建任务
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

  // MARK: 获取任务列表
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

  // MARK: 获取任务详情
  @Get(':id')
  @ApiOperation({ summary: '获取任务详情' })
  findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.findOne(id, userId);
  }

  // MARK: 更新任务
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

  // MARK: 删除任务
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除任务' })
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.remove(id, userId);
  }

  // MARK: 添加评论
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

  // MARK: 添加依赖
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
