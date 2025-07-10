import { IsOptional, IsString, IsInt } from 'class-validator';
import { IssueStatus } from '@prisma/client';

export class UpdateIssueDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Workflow fields
  @IsOptional()
  @IsString()
  currentStepId?: string;

  @IsOptional()
  @IsInt()
  currentStepIndex?: number;

  @IsOptional()
  currentStepStatus?: IssueStatus;
}
