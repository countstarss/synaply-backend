import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  DocKind,
  VisibilityType,
} from '../../../prisma/generated/prisma/client';
import { emptyStringToUndefined } from './transformers';

export class CreateDocDto {
  @ApiProperty({
    description: '文档标题',
    example: '设计评审纪要',
  })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({
    description: 'BlockNote JSON 字符串',
  })
  @IsOptional()
  @IsString()
  content?: string;

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
