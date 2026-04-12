import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

function emptyStringToUndefined({ value }: { value: unknown }) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class SearchWorkflowsDto {
  @ApiPropertyOptional({
    description: '搜索关键词，可匹配工作流名称 / 描述 / 版本',
  })
  @IsOptional()
  @Transform(emptyStringToUndefined)
  @IsString()
  query?: string;

  @ApiPropertyOptional({
    description: '返回条数，默认 8，最大 20',
    default: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit?: number;
}
