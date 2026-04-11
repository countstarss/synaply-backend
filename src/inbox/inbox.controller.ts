import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { InboxService } from './inbox.service';
import { ClearInboxItemsDto } from './dto/clear-inbox-items.dto';
import { QueryInboxDto } from './dto/query-inbox.dto';
import { SnoozeInboxItemDto } from './dto/snooze-inbox-item.dto';

@ApiTags('inbox')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('workspaces/:workspaceId/inbox')
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的 Inbox feed' })
  @ApiParam({ name: 'workspaceId', description: '工作空间 ID' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query() query: QueryInboxDto,
  ) {
    return this.inboxService.getInbox(workspaceId, req.user?.sub, query);
  }

  @Get('summary')
  @ApiOperation({ summary: '获取当前用户的 Inbox summary' })
  @ApiParam({ name: 'workspaceId', description: '工作空间 ID' })
  getSummary(@Param('workspaceId') workspaceId: string, @Req() req: Request) {
    return this.inboxService.getInboxSummary(workspaceId, req.user?.sub);
  }

  @Post(':itemId/seen')
  @ApiOperation({ summary: '将 Inbox item 标记为 seen' })
  markSeen(
    @Param('workspaceId') workspaceId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.inboxService.markSeen(workspaceId, req.user?.sub, itemId);
  }

  @Post(':itemId/unread')
  @ApiOperation({ summary: '将 Inbox item 标记为 unread' })
  markUnread(
    @Param('workspaceId') workspaceId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.inboxService.markUnread(workspaceId, req.user?.sub, itemId);
  }

  @Post(':itemId/done')
  @ApiOperation({ summary: '将 Inbox item 标记为 done' })
  markDone(
    @Param('workspaceId') workspaceId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.inboxService.markDone(workspaceId, req.user?.sub, itemId);
  }

  @Post(':itemId/dismiss')
  @ApiOperation({ summary: '将 Inbox item 标记为 dismissed' })
  dismiss(
    @Param('workspaceId') workspaceId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
  ) {
    return this.inboxService.dismiss(workspaceId, req.user?.sub, itemId);
  }

  @Post(':itemId/snooze')
  @ApiOperation({ summary: '将 Inbox item snooze 到指定时间' })
  snooze(
    @Param('workspaceId') workspaceId: string,
    @Param('itemId') itemId: string,
    @Req() req: Request,
    @Body() dto: SnoozeInboxItemDto,
  ) {
    return this.inboxService.snooze(workspaceId, req.user?.sub, itemId, dto);
  }

  @Post('clear')
  @ApiOperation({ summary: '批量 clear Inbox items' })
  clearItems(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Body() dto: ClearInboxItemsDto,
  ) {
    return this.inboxService.clearItems(
      workspaceId,
      req.user?.sub,
      dto.itemIds,
    );
  }
}
