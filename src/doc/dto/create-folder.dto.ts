import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { VisibilityType } from '../../../prisma/generated/prisma/client';
import { emptyStringToUndefined } from './transformers';

export class CreateFolderDto {
  @ApiProperty({
    description: '文件夹标题',
    example: '产品方案',
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: '文件夹描述',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: '父级文件夹 ID',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID()
  parentDocument?: string;

  @ApiPropertyOptional({
    description: '关联项目 ID',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: '关联 Issue ID',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID()
  issueId?: string;

  @ApiPropertyOptional({
    description: '关联 Workflow ID',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID()
  workflowId?: string;

  @ApiPropertyOptional({
    description: '可见性',
    enum: VisibilityType,
  })
  @IsOptional()
  @IsEnum(VisibilityType)
  visibility?: VisibilityType;

  @ApiPropertyOptional({
    description: '排序序号',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  order?: number;
}
