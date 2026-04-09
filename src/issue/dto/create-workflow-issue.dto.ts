import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IssuePriority,
  VisibilityType,
} from '../../../prisma/generated/prisma/client';

export class CreateWorkflowIssueDto {
  @ApiProperty({
    description: 'The title of the workflow run issue',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'The description of the workflow run issue',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The workspace ID of the issue',
  })
  @IsString()
  workspaceId: string;

  @ApiPropertyOptional({
    description: 'The due date of the issue',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiProperty({
    description: 'The workflow template ID',
  })
  @IsString()
  workflowId: string;

  @ApiPropertyOptional({
    description: 'The project ID this workflow run belongs to',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Primary assignee member ID',
  })
  @IsOptional()
  @IsString()
  directAssigneeId?: string;

  @ApiPropertyOptional({
    description: 'Issue state ID',
  })
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiPropertyOptional({
    description: 'Issue priority',
    enum: IssuePriority,
  })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({
    description: 'Issue visibility',
    enum: VisibilityType,
  })
  @IsOptional()
  @IsEnum(VisibilityType)
  visibility?: VisibilityType;

  @ApiPropertyOptional({
    description: 'Additional assignee member IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assigneeIds?: string[];

  @ApiPropertyOptional({
    description: 'Label IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labelIds?: string[];
}
