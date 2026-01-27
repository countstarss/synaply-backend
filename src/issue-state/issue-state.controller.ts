import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IssueStateService } from './issue-state.service';
import { CreateIssueStateDto, UpdateIssueStateDto } from './dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Request } from 'express';

@Controller('workspaces/:workspaceId/issue-states')
@UseGuards(SupabaseAuthGuard)
export class IssueStateController {
  constructor(private readonly issueStateService: IssueStateService) {}

  /**
   * 获取 workspace 的所有状态
   */
  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueStateService.findAll(workspaceId, userId);
  }

  /**
   * 创建新状态
   */
  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Body() dto: CreateIssueStateDto,
  ) {
    const userId = req.user?.sub;
    return this.issueStateService.create(workspaceId, userId, dto);
  }

  /**
   * 获取单个状态
   */
  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueStateService.findOne(id, userId);
  }

  /**
   * 更新状态
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Req() req: Request,
    @Body() dto: UpdateIssueStateDto,
  ) {
    const userId = req.user?.sub;
    return this.issueStateService.update(id, userId, dto);
  }

  /**
   * 删除状态
   */
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = req.user?.sub;
    return this.issueStateService.remove(id, userId);
  }
}
