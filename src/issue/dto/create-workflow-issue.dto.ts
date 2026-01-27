import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
// import { IssuePriority, IssueStatus, VisibilityType } from '../../../prisma/generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueStatus } from '../../../prisma/generated/prisma/client';

// MARK: - CreateIssueDto
export class CreateWorkflowIssueDto {
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
    description: 'The due date of the issue',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: Date;

  @ApiProperty({
    description: 'The workflow ID of the issue',
  })
  @IsNotEmpty()
  @IsString()
  workflowId: string;

  @ApiProperty({
    description: 'The workflow snapshot of the issue, it is a JSON string',
  })
  @IsNotEmpty()
  @IsString()
  workflowSnapshot: string;

  @ApiProperty({
    description: 'The total steps of the issue',
  })
  @IsNotEmpty()
  @IsString()
  totalSteps: number;

  @ApiProperty({
    description: 'The current step ID of the issue',
  })
  @IsNotEmpty()
  @IsString()
  currentStepId: string;

  @ApiProperty({
    description: 'The current step index of the issue',
  })
  @IsNotEmpty()
  @IsString()
  currentStepIndex: number;

  @ApiProperty({
    description: 'The current step status of the issue',
  })
  @IsNotEmpty()
  @IsEnum(IssueStatus)
  currentStepStatus: IssueStatus;
}
