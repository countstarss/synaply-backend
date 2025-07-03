import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { IssuePriority, IssueStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateIssueDto {
  @ApiProperty({
    description: 'The title of the issue',
  })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'The description of the issue',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The workspace ID of the issue',
  })
  @IsNotEmpty()
  @IsString()
  workspaceId: string;

  @ApiPropertyOptional({
    description: 'The project ID of the issue',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'The workflow ID of the issue',
  })
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional({
    description: 'The current step ID of the issue',
  })
  @IsOptional()
  @IsString()
  currentStepId?: string;

  @ApiPropertyOptional({
    description: 'The direct assignee ID of the issue',
  })
  @IsOptional()
  @IsString()
  directAssigneeId?: string;

  @ApiPropertyOptional({
    description: 'The status of the issue',
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
    description: 'The parent task ID of the issue',
  })
  @IsOptional()
  @IsString()
  parentTaskId?: string;
}
