import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FindCommentsDto {
  @ApiProperty({ description: '关联的问题ID' })
  @IsUUID()
  @IsNotEmpty()
  issueId: string;

  @ApiPropertyOptional({ description: '工作区ID' })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;

  @ApiPropertyOptional({ description: '父评论ID（为空时返回顶级评论）' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
