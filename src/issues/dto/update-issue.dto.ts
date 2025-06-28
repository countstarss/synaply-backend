import { PartialType } from '@nestjs/mapped-types';
import { CreateIssueDto } from './create-issue.dto';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { IssuePriority, IssueStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

  export class UpdateIssueDto extends PartialType(CreateIssueDto) {
  @ApiPropertyOptional({
    description: 'The title of the issue',
  })
  @IsOptional()
  @IsEnum(IssueStatus)
  status?: IssueStatus;

  @ApiPropertyOptional({
    description: 'The priority of the issue',
  })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({
    description: 'The due date of the issue',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiPropertyOptional({
    description: 'The start date of the issue',
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'The current step ID of the issue',
  })
  @IsOptional()
  @IsString()
  currentStepId?: string;
}