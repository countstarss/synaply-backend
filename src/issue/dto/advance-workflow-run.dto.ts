import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

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

  @ApiPropertyOptional({
    description: 'Whether the final workflow completion has been confirmed with the team',
  })
  @IsOptional()
  @IsBoolean()
  completionConfirmed?: boolean;

  @ApiPropertyOptional({
    description: 'Issue title typed by the user to confirm final workflow completion',
  })
  @IsOptional()
  @IsString()
  issueTitleConfirmation?: string;
}
