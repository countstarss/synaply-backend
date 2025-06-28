import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

  export class CreateWorkflowStepDto {
  @ApiProperty({
    description: 'The name of the workflow step',
    example: 'Step 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'The description of the workflow step',
    example: 'This is a description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'The order of the workflow step',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  order: number;

  @ApiPropertyOptional({
    description: 'The assignee ID of the workflow step'
  })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}

export class UpdateWorkflowStepDto extends PartialType(CreateWorkflowStepDto) {
  @IsOptional()
  @IsString()
  id?: string;
}
