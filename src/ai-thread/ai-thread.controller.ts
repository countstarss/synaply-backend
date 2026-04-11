import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AiThreadService } from './ai-thread.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { AppendMessageDto } from './dto/append-message.dto';
import { StartRunDto } from './dto/start-run.dto';
import { FinishRunDto } from './dto/finish-run.dto';
import { RecordStepDto } from './dto/record-step.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { PinContextDto } from './dto/pin-context.dto';

/**
 * 这一组接口的消费者是 Next.js agent runtime（synaply-frontend/app/api/ai/*），
 * 不是浏览器。Next runtime 用 supabase access token 透传调用本接口，
 * 由 SupabaseAuthGuard 解析出 user。
 */
@ApiTags('ai-thread')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('workspaces/:workspaceId/ai-threads')
export class AiThreadController {
  constructor(private readonly aiThreadService: AiThreadService) {}

  @Post()
  @ApiOperation({ summary: '创建一个 AI thread' })
  @ApiParam({ name: 'workspaceId' })
  createThread(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateThreadDto,
  ) {
    return this.aiThreadService.createThread(workspaceId, req.user!.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: '列出当前用户的 AI thread' })
  listThreads(
    @Param('workspaceId') workspaceId: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Math.min(Number(limit) || 30, 100) : 30;
    return this.aiThreadService.listThreads(
      workspaceId,
      req.user!.sub,
      parsedLimit,
    );
  }

  @Get(':threadId')
  @ApiOperation({ summary: '获取一个 AI thread 的元数据' })
  getThread(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
  ) {
    return this.aiThreadService.getThread(workspaceId, req.user!.sub, threadId);
  }

  @Get(':threadId/messages')
  @ApiOperation({ summary: '获取一个 AI thread 的消息历史' })
  listMessages(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? Math.min(Number(limit) || 200, 200) : 200;
    return this.aiThreadService.getThreadMessages(
      workspaceId,
      req.user!.sub,
      threadId,
      parsedLimit,
      cursor,
    );
  }

  @Post(':threadId/messages')
  @ApiOperation({
    summary: '追加一条消息（Next runtime 写线程历史用，非用户直接入口）',
  })
  appendMessage(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: AppendMessageDto,
  ) {
    return this.aiThreadService.appendMessage(
      workspaceId,
      req.user!.sub,
      threadId,
      dto,
    );
  }

  @Post(':threadId/runs')
  @ApiOperation({ summary: '在 thread 上启动一次 agent run' })
  startRun(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: StartRunDto,
  ) {
    return this.aiThreadService.startRun(
      workspaceId,
      req.user!.sub,
      threadId,
      dto,
    );
  }

  @Post(':threadId/runs/:runId/steps')
  @ApiOperation({ summary: '记录 run 的一次 step (LLM 调用 / tool 调用)' })
  recordStep(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('runId') runId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: RecordStepDto,
  ) {
    return this.aiThreadService.recordRunStep(
      workspaceId,
      req.user!.sub,
      threadId,
      runId,
      dto,
    );
  }

  @Post(':threadId/runs/:runId/finish')
  @ApiOperation({ summary: '结束一次 run（成功 / 失败 / 取消）' })
  finishRun(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('runId') runId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: FinishRunDto,
  ) {
    return this.aiThreadService.finishRun(
      workspaceId,
      req.user!.sub,
      threadId,
      runId,
      dto,
    );
  }

  @Post(':threadId/approvals')
  @ApiOperation({
    summary: '创建一个 pending approval（CONFIRM 类动作的预演结果）',
  })
  createApproval(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateApprovalDto,
  ) {
    return this.aiThreadService.createApproval(
      workspaceId,
      req.user!.sub,
      threadId,
      dto,
    );
  }

  @Post(':threadId/approvals/:approvalId/confirm')
  @ApiOperation({ summary: '用户确认一个 pending approval' })
  confirmApproval(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('approvalId') approvalId: string,
    @Req() req: Request,
  ) {
    return this.aiThreadService.confirmApproval(
      workspaceId,
      req.user!.sub,
      threadId,
      approvalId,
    );
  }

  @Post(':threadId/approvals/:approvalId/reject')
  @ApiOperation({ summary: '用户拒绝一个 pending approval' })
  rejectApproval(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('approvalId') approvalId: string,
    @Req() req: Request,
  ) {
    return this.aiThreadService.rejectApproval(
      workspaceId,
      req.user!.sub,
      threadId,
      approvalId,
    );
  }

  @Post(':threadId/pins')
  @ApiOperation({ summary: '给 thread pin 一个对象到上下文' })
  pinContext(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Req() req: Request,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: PinContextDto,
  ) {
    return this.aiThreadService.pinContext(
      workspaceId,
      req.user!.sub,
      threadId,
      dto,
    );
  }

  @Delete(':threadId/pins/:pinId')
  @ApiOperation({ summary: '解除一个 context pin' })
  unpinContext(
    @Param('workspaceId') workspaceId: string,
    @Param('threadId') threadId: string,
    @Param('pinId') pinId: string,
    @Req() req: Request,
  ) {
    return this.aiThreadService.unpinContext(
      workspaceId,
      req.user!.sub,
      threadId,
      pinId,
    );
  }
}
