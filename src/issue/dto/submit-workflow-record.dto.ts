import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitWorkflowRecordDto {
  @ApiPropertyOptional({
    description: 'Result summary for the current step',
  })
  @IsOptional()
  @IsString()
  resultText?: string;

  @ApiPropertyOptional({
    description: 'Optional attachments payload',
  })
  @IsOptional()
  attachments?: unknown;
}
