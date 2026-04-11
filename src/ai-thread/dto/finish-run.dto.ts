import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { AiRunStatus } from '../../../prisma/generated/prisma/client';

export class FinishRunDto {
  @ApiProperty({ enum: AiRunStatus })
  @IsEnum(AiRunStatus)
  status!: AiRunStatus;

  @ApiPropertyOptional({ description: '总消耗 token 数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokensUsed?: number;

  @ApiPropertyOptional({ description: '错误信息（任意 JSON）' })
  @IsOptional()
  lastError?: unknown;
}
