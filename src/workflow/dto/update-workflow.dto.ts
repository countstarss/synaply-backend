import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkflowDto } from './create-workflow.dto';
import {
  IsEnum,
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
} from 'class-validator';
import { WorkflowStatus } from '../../../prisma/generated/prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {
  @ApiPropertyOptional({
    description: 'The status of the workflow',
  })
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @ApiPropertyOptional({
    description: 'The JSON data of the workflow (nodes, edges, etc.)',
  })
  @IsOptional()
  json?: Record<string, unknown> | string;

  @ApiPropertyOptional({
    description: 'The assignee map of the workflow',
  })
  @IsOptional()
  assigneeMap?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Total number of steps in the workflow',
  })
  @IsOptional()
  @IsNumber()
  totalSteps?: number;

  @ApiPropertyOptional({
    description: 'Current step index',
  })
  @IsOptional()
  @IsNumber()
  currentStepIndex?: number;

  @ApiPropertyOptional({
    description: 'Workflow version',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a system template',
  })
  @IsOptional()
  @IsBoolean()
  isSystemTemplate?: boolean;
}
