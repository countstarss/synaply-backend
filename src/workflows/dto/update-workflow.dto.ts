import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkflowDto } from './create-workflow.dto';
import { CreateWorkflowStepDto, UpdateWorkflowStepDto } from './workflow-step.dto';
import { IsArray, IsEnum, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WorkflowStatus } from '@prisma/client';

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {
  @IsOptional()
  @IsEnum(WorkflowStatus)
  status?: WorkflowStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWorkflowStepDto)
  steps?: UpdateWorkflowStepDto[];
}
