import { IsNotEmpty, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisibilityType } from '@prisma/client';

export class CreateWorkflowDto {
  @ApiProperty({
    description: 'The name of the workflow',
    example: 'Workflow 1',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'The visibility of the workflow',
    enum: VisibilityType,
    default: VisibilityType.PRIVATE,
  })
  @IsEnum(VisibilityType)
  @IsOptional()
  visibility?: VisibilityType;
}
