import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsEnum } from 'class-validator';
import { VisibilityType } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({
    description: 'The name of the project',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'The description of the project',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'The visibility of the project',
    enum: VisibilityType,
    default: VisibilityType.PRIVATE,
  })
  @IsEnum(VisibilityType)
  @IsOptional()
  visibility?: VisibilityType;
}
