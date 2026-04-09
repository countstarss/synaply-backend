import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { WorkspaceType } from '../../../prisma/generated/prisma/client';
import { emptyStringToUndefined } from './transformers';

export enum DocContextValue {
  PERSONAL = 'personal',
  TEAM = 'team',
  TEAM_PERSONAL = 'team-personal',
}

export class QueryDocsDto {
  @ApiPropertyOptional({
    description: '文档上下文',
    enum: DocContextValue,
  })
  @IsOptional()
  @IsEnum(DocContextValue)
  context?: DocContextValue;

  @ApiPropertyOptional({
    description: '工作空间类型，仅用于兼容前端查询参数',
    enum: WorkspaceType,
  })
  @IsOptional()
  @IsEnum(WorkspaceType)
  workspaceType?: WorkspaceType;

  @ApiPropertyOptional({
    description: '按项目过滤文档',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional({
    description: '是否包含归档文档',
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeArchived?: boolean;

  @ApiPropertyOptional({
    description: '父级文档 ID，仅保留兼容参数，不在本轮读取逻辑中使用',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  parentDocument?: string;
}
