import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AiContextService } from './ai-context.service';
import { GetSurfaceSummariesDto } from './dto/get-summaries.dto';
import { AiSurfaceType } from '../../prisma/generated/prisma/client';
import { SearchDocsDto } from './dto/search-docs.dto';
import { AssembleCodingPromptDto } from './dto/assemble-coding-prompt.dto';
import { SearchProjectsDto } from './dto/search-projects.dto';
import { ListIssuesDto } from './dto/list-issues.dto';
import { SearchIssuesDto } from './dto/search-issues.dto';
import { SearchWorkspaceMembersDto } from './dto/search-workspace-members.dto';

@ApiTags('ai-context')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('workspaces/:workspaceId/ai-context')
export class AiContextController {
  constructor(private readonly aiContextService: AiContextService) {}

  @Get('surface')
  @ApiOperation({ summary: '获取一个 surface 对象的浓缩摘要' })
  getSurface(
    @Param('workspaceId') workspaceId: string,
    @Query('surfaceType') surfaceType: AiSurfaceType,
    @Query('surfaceId') surfaceId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getSurfaceSummary(
      workspaceId,
      req.user!.sub,
      surfaceType,
      surfaceId,
    );
  }

  @Post('summaries')
  @ApiOperation({ summary: '批量获取一组 pin 的浓缩摘要（最多 5 个）' })
  getSummaries(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: GetSurfaceSummariesDto,
  ) {
    return this.aiContextService.getSurfaceSummaries(
      workspaceId,
      req.user!.sub,
      dto.pins,
    );
  }

  @Get('workspace-summary')
  @ApiOperation({ summary: '获取当前 workspace 的协作摘要' })
  getWorkspaceSummary(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getWorkspaceSummary(
      workspaceId,
      req.user!.sub,
    );
  }

  @Get('actor-context')
  @ApiOperation({ summary: '获取当前用户在当前 workspace 内的 actor 上下文' })
  getActorContext(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getActorContext(workspaceId, req.user!.sub);
  }

  @Get('projects/search')
  @ApiOperation({ summary: '按关键词搜索当前 workspace 内可读项目' })
  searchProjects(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: SearchProjectsDto,
  ) {
    return this.aiContextService.searchProjects(
      workspaceId,
      req.user!.sub,
      query.query ?? '',
      query.limit,
    );
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: '获取 project 的深度详情，供 AI read tool 使用' })
  getProjectDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getProjectDetail(
      workspaceId,
      req.user!.sub,
      projectId,
    );
  }

  @Get('issues/list')
  @ApiOperation({ summary: '按项目 / assignee / 状态类别列出 issue' })
  listIssues(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: ListIssuesDto,
  ) {
    return this.aiContextService.listIssues(workspaceId, req.user!.sub, query);
  }

  @Get('issues/search')
  @ApiOperation({ summary: '按关键词搜索当前 workspace 内可读 issue' })
  searchIssues(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: SearchIssuesDto,
  ) {
    return this.aiContextService.searchIssues(
      workspaceId,
      req.user!.sub,
      query.query ?? '',
      query.projectId,
      query.limit,
    );
  }

  @Get('issues/:issueId')
  @ApiOperation({ summary: '获取 issue 的深度详情，供 AI read tool 使用' })
  getIssueDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('issueId') issueId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getIssueDetail(
      workspaceId,
      req.user!.sub,
      issueId,
    );
  }

  @Get('workflow-runs/:issueId')
  @ApiOperation({
    summary: '获取 workflow run 的深度详情，供 AI read tool 使用',
  })
  getWorkflowRunDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('issueId') issueId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getWorkflowRunDetail(
      workspaceId,
      req.user!.sub,
      issueId,
    );
  }

  @Get('docs/search')
  @ApiOperation({ summary: '按关键词搜索当前 workspace 内可读 docs' })
  searchDocs(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: SearchDocsDto,
  ) {
    return this.aiContextService.searchDocs(
      workspaceId,
      req.user!.sub,
      query.query ?? '',
      query.limit,
    );
  }

  @Get('workspace-members/search')
  @ApiOperation({ summary: '按关键词搜索当前 workspace 内可用成员' })
  searchWorkspaceMembers(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: SearchWorkspaceMembersDto,
  ) {
    return this.aiContextService.searchWorkspaceMembers(
      workspaceId,
      req.user!.sub,
      query.query ?? '',
      query.limit,
    );
  }

  @Get('docs/:docId')
  @ApiOperation({ summary: '获取 doc 的深度详情，供 AI read tool 使用' })
  getDocDetail(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getDocDetail(
      workspaceId,
      req.user!.sub,
      docId,
    );
  }

  @Get('capabilities')
  @ApiOperation({
    summary: '聚合当前用户在当前 workspace 下的 AI 可执行动作能力',
  })
  getCapabilities(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    return this.aiContextService.getCapabilities(workspaceId, req.user!.sub);
  }

  @Post('coding-prompt/assemble')
  @ApiOperation({
    summary: '组装一个可直接交给 Claude Code / Codex 的编码 handoff prompt',
  })
  assembleCodingPrompt(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AssembleCodingPromptDto,
  ) {
    return this.aiContextService.assembleCodingPrompt(
      workspaceId,
      req.user!.sub,
      dto.issueId,
    );
  }
}
