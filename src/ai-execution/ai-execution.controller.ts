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
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AiExecutionService } from './ai-execution.service';
import { QueryAiExecutionsDto } from './dto/query-ai-executions.dto';
import { ExecuteAiActionDto } from './dto/execute-ai-action.dto';

@ApiTags('ai-execution')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/ai-execution')
@UseGuards(SupabaseAuthGuard)
export class AiExecutionController {
  constructor(private readonly aiExecutionService: AiExecutionService) {}

  @Get('capabilities')
  @ApiOperation({ summary: '获取当前工作空间的 AI 可执行动作能力清单' })
  getCapabilities(@Param('workspaceId') workspaceId: string, @Req() req) {
    return this.aiExecutionService.getCapabilities(workspaceId, req.user.sub);
  }

  @Get('manifest')
  @ApiOperation({
    summary:
      '获取机器可读的 AI 动作 manifest（含 JSON Schema），供 Next runtime 动态生成 typed tools',
  })
  getManifest(@Param('workspaceId') workspaceId: string, @Req() req) {
    return this.aiExecutionService.getActionManifest(
      workspaceId,
      req.user.sub,
    );
  }

  @Get('executions')
  @ApiOperation({ summary: '获取当前工作空间最近的 AI 执行审计记录' })
  listExecutions(
    @Param('workspaceId') workspaceId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryAiExecutionsDto,
    @Req() req,
  ) {
    return this.aiExecutionService.listExecutions(
      workspaceId,
      req.user.sub,
      query.limit,
    );
  }

  @Post('actions/:actionKey/execute')
  @ApiOperation({ summary: '预演或执行一个 AI 动作' })
  executeAction(
    @Param('workspaceId') workspaceId: string,
    @Param('actionKey') actionKey: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: ExecuteAiActionDto,
    @Req() req,
  ) {
    return this.aiExecutionService.executeAction(
      workspaceId,
      actionKey,
      dto.input,
      req.user.sub,
      {
        dryRun: dto.dryRun,
        confirmed: dto.confirmed,
        conversationId: dto.conversationId,
      },
    );
  }
}
