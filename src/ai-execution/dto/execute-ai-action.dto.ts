import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class ExecuteAiActionDto {
  @ApiPropertyOptional({
    description: '动作输入参数，由 AI 或前端面板传入',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: '仅生成预演结果，不真正执行',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: '当动作需要确认时，显式确认后再执行',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  confirmed?: boolean;

  @ApiPropertyOptional({
    description: '可选的对话 / 会话 ID，便于后续串联审计',
  })
  @IsOptional()
  @IsString()
  conversationId?: string;
}
