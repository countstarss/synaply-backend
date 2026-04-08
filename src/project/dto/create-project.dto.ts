import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VisibilityType } from '../../../prisma/generated/prisma/client';
import {
  ProjectRiskLevelValue,
  ProjectStatusValue,
} from '../project.constants';

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
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'One-line brief describing the project outcome',
    example: 'Bring launch readiness, release coordination, and blockers into one room.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  brief?: string;

  @ApiPropertyOptional({
    description: 'The collaboration status of the project',
    enum: ProjectStatusValue,
  })
  @IsOptional()
  @IsEnum(ProjectStatusValue)
  status?: ProjectStatusValue;

  @ApiPropertyOptional({
    description: 'The current phase or milestone of the project',
    example: 'Design review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  phase?: string;

  @ApiPropertyOptional({
    description: 'The current risk level of the project',
    enum: ProjectRiskLevelValue,
  })
  @IsOptional()
  @IsEnum(ProjectRiskLevelValue)
  riskLevel?: ProjectRiskLevelValue;

  @ApiPropertyOptional({
    description: 'The team member responsible for the project',
    example: '0c0e68b1-1d0d-4dc6-85ea-60df62311b13',
  })
  @IsOptional()
  @IsUUID()
  ownerMemberId?: string;

  @ApiPropertyOptional({
    description: 'The last time the project had an async sync or review',
    example: '2026-04-09T10:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;

  @ApiPropertyOptional({
    description: 'The visibility of the project',
    enum: VisibilityType,
  })
  @IsOptional()
  @IsEnum(VisibilityType)
  visibility?: VisibilityType;
}
