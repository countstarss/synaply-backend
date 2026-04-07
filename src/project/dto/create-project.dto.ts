import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { VisibilityType } from '../../../prisma/generated/prisma/client';

export class CreateProjectDto {
  @ApiProperty({
    description: 'The name of the project',
    example: 'Alpha Project',
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'The description of the project',
    example: 'Project for the Q2 launch',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'The visibility of the project',
    enum: VisibilityType,
  })
  @IsOptional()
  @IsEnum(VisibilityType)
  visibility?: VisibilityType;
}
