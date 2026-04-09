import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum WorkflowReviewOutcome {
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
}

export class RespondWorkflowReviewDto {
  @ApiProperty({
    description: 'Review outcome for the pending workflow review request',
    enum: WorkflowReviewOutcome,
  })
  @IsEnum(WorkflowReviewOutcome)
  outcome: WorkflowReviewOutcome;

  @ApiProperty({
    description: 'Optional comment for the review response',
    required: false,
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
