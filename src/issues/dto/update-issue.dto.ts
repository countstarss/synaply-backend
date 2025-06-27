import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueDto } from './create-issue.dto';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { IssuePriority, IssueStatus } from '@prisma/client';

export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsString()
  currentStepId?: string;
}