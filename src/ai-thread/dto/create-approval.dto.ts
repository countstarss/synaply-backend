import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateApprovalDto {
  @ApiProperty({ description: '关联的 run ID' })
  @IsString()
  runId!: string;

  @ApiProperty({ description: 'ai-execution action key' })
  @IsString()
  actionKey!: string;

  @ApiPropertyOptional({ description: '人类可读摘要' })
  @IsOptional()
  @IsString()
  summary?: string;

  @ApiPropertyOptional({ description: '动作 input payload' })
  @IsOptional()
  input?: unknown;

  @ApiPropertyOptional({ description: 'dryRun 返回的 preview 结果' })
  @IsOptional()
  previewResult?: unknown;
}
