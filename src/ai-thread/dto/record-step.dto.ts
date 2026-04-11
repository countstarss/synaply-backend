import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AiRunStepKind } from '../../../prisma/generated/prisma/client';

export class RecordStepDto {
  @ApiProperty({ enum: AiRunStepKind })
  @IsEnum(AiRunStepKind)
  kind!: AiRunStepKind;

  @ApiProperty({ description: 'run 内的 step 序号', minimum: 0 })
  @IsInt()
  @Min(0)
  stepIndex!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toolName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  toolInput?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  toolOutput?: unknown;

  @ApiPropertyOptional({ description: 'prompt 截断快照' })
  @IsOptional()
  promptSnapshot?: unknown;

  @ApiPropertyOptional({ description: 'response 截断快照' })
  @IsOptional()
  responseSnapshot?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  tokensIn?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  tokensOut?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  latencyMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  error?: unknown;
}
