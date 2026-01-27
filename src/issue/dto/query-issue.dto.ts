import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueStateCategory, VisibilityType, IssuePriority, IssueType } from '../../../prisma/generated/prisma/enums';

export enum IssueScope {
  ALL = 'all',
  TEAM = 'team',
  PERSONAL = 'personal',
}

export class QueryIssueDto {
  @ApiPropertyOptional({
    description: 'Filter by scope: all, team, or personal',
    enum: IssueScope,
    default: IssueScope.ALL,
  })
  @IsOptional()
  @IsEnum(IssueScope)
  scope?: IssueScope = IssueScope.ALL;

  @ApiPropertyOptional({
    description: 'Filter by state ID',
  })
  @IsOptional()
  @IsString()
  stateId?: string;

  @ApiPropertyOptional({
    description: 'Filter by state category',
    enum: IssueStateCategory,
  })
  @IsOptional()
  @IsEnum(IssueStateCategory)
  stateCategory?: IssueStateCategory;

  @ApiPropertyOptional({
    description: 'Filter by project ID',
  })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Filter by assignee member ID',
  })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by label ID',
  })
  @IsOptional()
  @IsString()
  labelId?: string;

  @ApiPropertyOptional({
    description: 'Filter by issue type',
    enum: IssueType,
  })
  @IsOptional()
  @IsEnum(IssueType)
  issueType?: IssueType;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    enum: IssuePriority,
  })
  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order: asc or desc',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Pagination cursor',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items to return',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;
}
