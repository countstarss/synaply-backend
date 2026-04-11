import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  AiPinSource,
  AiSurfaceType,
} from '../../../prisma/generated/prisma/client';

export class PinContextDto {
  @ApiProperty({ enum: AiSurfaceType })
  @IsEnum(AiSurfaceType)
  surfaceType!: AiSurfaceType;

  @ApiProperty()
  @IsString()
  surfaceId!: string;

  @ApiPropertyOptional({ enum: AiPinSource, default: AiPinSource.USER })
  @IsOptional()
  @IsEnum(AiPinSource)
  source?: AiPinSource;
}
