import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class CreateWorkflowStepDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNotEmpty()
  @IsInt()
  order: number;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class UpdateWorkflowStepDto extends PartialType(CreateWorkflowStepDto) {
  @IsOptional()
  @IsString()
  id?: string;
}
