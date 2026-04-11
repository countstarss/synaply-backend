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
}
