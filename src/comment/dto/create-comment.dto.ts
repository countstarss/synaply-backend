import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: '评论内容' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: '关联的问题ID' })
  @IsUUID()
  @IsNotEmpty()
  issueId: string;

  @ApiProperty({ description: '工作空间ID' })
  @IsUUID()
  @IsNotEmpty()
  workspaceId: string;

  @ApiPropertyOptional({ description: '父评论ID（用于回复功能）' })
  @IsUUID()
  @IsOptional()
  parentId?: string;
}
