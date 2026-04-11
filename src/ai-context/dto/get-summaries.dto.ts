import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsString,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AiSurfaceType } from '../../../prisma/generated/prisma/client';

export class SurfacePinDto {
  @ApiProperty({ enum: AiSurfaceType })
  @IsEnum(AiSurfaceType)
  surfaceType!: AiSurfaceType;

  @ApiProperty()
  @IsString()
  surfaceId!: string;
}

export class GetSurfaceSummariesDto {
  @ApiProperty({ type: [SurfacePinDto], description: '最多 5 个 pin' })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SurfacePinDto)
  pins!: SurfacePinDto[];
}
