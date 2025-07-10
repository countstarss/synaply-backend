import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TeamMemberDto {
  @ApiProperty({ description: '团队成员ID' })
  id: string;

  @ApiProperty({ description: '用户名称' })
  name?: string;

  @ApiProperty({ description: '用户头像' })
  avatarUrl?: string;
}

export class CommentDto {
  @ApiProperty({ description: '评论ID' })
  id: string;

  @ApiProperty({ description: '评论内容' })
  content: string;

  @ApiProperty({ description: '关联的问题ID' })
  issueId: string;

  @ApiProperty({ description: '作者ID' })
  authorId: string;

  @ApiPropertyOptional({ description: '父评论ID' })
  parentId?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;

  @ApiProperty({ description: '作者信息', type: TeamMemberDto })
  author: TeamMemberDto;
}
