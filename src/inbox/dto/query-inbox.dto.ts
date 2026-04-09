import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class QueryInboxDto {
  @ApiPropertyOptional({ description: 'Bucket filter' })
  @IsOptional()
  @IsString()
  bucket?: string;

  @ApiPropertyOptional({ description: 'Status filter' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Type filter' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Project filter' })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: 'Requires action filter' })
  @IsOptional()
  @IsString()
  requiresAction?: string;

  @ApiPropertyOptional({ description: 'Cursor id for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: 'Page size', minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
