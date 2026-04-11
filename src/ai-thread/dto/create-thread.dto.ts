import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AiSurfaceType } from '../../../prisma/generated/prisma/client';

export class CreateThreadDto {
  @ApiPropertyOptional({ description: '线程标题，可空' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: '线程创建时所在的 surface 类型',
    enum: AiSurfaceType,
  })
  @IsOptional()
  @IsEnum(AiSurfaceType)
  originSurfaceType?: AiSurfaceType;

  @ApiPropertyOptional({ description: '线程创建时所在的 surface ID' })
  @IsOptional()
  @IsString()
  originSurfaceId?: string;
}
