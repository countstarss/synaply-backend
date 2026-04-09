import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { DocChangeSourceValue } from '../doc.constants';

export class CreateDocRevisionDto {
  @ApiProperty({
    description: '客户端 mutation ID，用于幂等',
  })
  @IsString()
  clientMutationId: string;

  @ApiPropertyOptional({
    description: '客户端编辑所基于的 revision ID',
  })
  @IsOptional()
  @IsUUID()
  baseRevisionId?: string;

  @ApiProperty({
    description: 'BlockNote JSON 字符串',
  })
  @IsString()
  contentSnapshot: string;

  @ApiPropertyOptional({
    description: '文档元数据快照 JSON 字符串',
  })
  @IsOptional()
  @IsString()
  metadataSnapshot?: string;

  @ApiPropertyOptional({
    description: '变更来源',
    enum: DocChangeSourceValue,
    default: DocChangeSourceValue.EDITOR,
  })
  @IsOptional()
  @IsEnum(DocChangeSourceValue)
  changeSource?: DocChangeSourceValue;
}
