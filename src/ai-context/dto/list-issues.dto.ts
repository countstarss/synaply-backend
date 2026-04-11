import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { IssueStateCategory } from '../../../prisma/generated/prisma/client';

function emptyStringToUndefined({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toEnumArray({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return undefined;
}

export enum AiIssueAssigneeScope {
  ANY = 'ANY',
  ME = 'ME',
}

export class ListIssuesDto {
  @ApiPropertyOptional({
    description: '限定某个项目 ID',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: '限定 assignee 范围',
    enum: AiIssueAssigneeScope,
    default: AiIssueAssigneeScope.ANY,
  })
  @IsOptional()
  @IsEnum(AiIssueAssigneeScope)
  assigneeScope?: AiIssueAssigneeScope = AiIssueAssigneeScope.ANY;

  @ApiPropertyOptional({
    description: '限定状态类别，可传单个值或逗号分隔列表',
    enum: IssueStateCategory,
    isArray: true,
  })
  @IsOptional()
  @Transform(toEnumArray)
  @IsArray()
  @IsEnum(IssueStateCategory, { each: true })
  stateCategories?: IssueStateCategory[];

  @ApiPropertyOptional({
    description: '返回条数，默认 10，最大 50',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
