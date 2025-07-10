import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
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
   */
  @Post()
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
   * MARK: - 获取任务列表
   * GET /workspaces/:workspaceId/issues
   */
  @Get()
  @ApiOperation({ summary: '获取任务列表 (简化版)' })
  findAll(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueService.findAll(workspaceId, userId);
  }
}