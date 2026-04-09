import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class AdvanceWorkflowRunDto {
  @ApiPropertyOptional({
    description: 'Optional step result summary before advancing',
  })
  @IsOptional()
  @IsString()
  resultText?: string;

  @ApiPropertyOptional({
    description: 'Optional comment for the transition',
  })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Optional attachments payload for the step record',
  })
  @IsOptional()
  attachments?: unknown;
}
