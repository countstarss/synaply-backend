import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  DocKind,
  VisibilityType,
} from '../../../prisma/generated/prisma/client';
import { emptyStringToUndefined } from './transformers';

export class UpdateDocMetaDto {
  @ApiPropertyOptional({
    description: '文档标题',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({
    description: '文件夹描述',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: '图标',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;

  @ApiPropertyOptional({
    description: '封面图 URL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImage?: string;

  @ApiPropertyOptional({
    description: '文档协作语义类型',
    enum: DocKind,
  })
  @IsOptional()
  @IsEnum(DocKind)
  kind?: DocKind;

  @ApiPropertyOptional({
    description: '文档模板 key',
    example: 'project-brief-v1',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  @MaxLength(100)
  templateKey?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: VisibilityType,
  })
  @IsOptional()
  @IsEnum(VisibilityType)
  visibility?: VisibilityType;
}
