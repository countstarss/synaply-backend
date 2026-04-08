import { ApiProperty } from '@nestjs/swagger';
import { WorkspaceType } from '../../../prisma/generated/prisma/client';

export class WorkspaceUserDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户邮箱' })
  email: string;

  @ApiProperty({ description: '用户名称', nullable: true })
  name?: string;

  @ApiProperty({ description: '用户头像URL', nullable: true })
  avatarUrl?: string;
}

export class WorkspaceTeamMemberDto {
  @ApiProperty({ description: '团队成员ID' })
  id: string;

  @ApiProperty({ description: '用户ID' })
  userId: string;

  @ApiProperty({ description: '成员角色' })
  role: string;
}

export class WorkspaceTeamDto {
  @ApiProperty({ description: '团队ID' })
  id: string;

  @ApiProperty({ description: '团队名称' })
  name: string;

  @ApiProperty({ description: '团队头像URL', nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({
    description: '团队成员列表',
    type: [WorkspaceTeamMemberDto],
    nullable: true,
  })
  members?: WorkspaceTeamMemberDto[];

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class WorkspaceDto {
  @ApiProperty({ description: '工作空间ID' })
  id: string;

  @ApiProperty({ description: '工作空间名称' })
  name: string;

  @ApiProperty({ description: '工作空间类型', enum: WorkspaceType })
  type: WorkspaceType;

  @ApiProperty({ description: '个人工作空间所属用户ID', nullable: true })
  userId?: string;

  @ApiProperty({ description: '团队工作空间所属团队ID', nullable: true })
  teamId?: string;

  @ApiProperty({
    description: '所属用户信息（个人工作空间）',
    type: WorkspaceUserDto,
    nullable: true,
  })
  user?: WorkspaceUserDto;

  @ApiProperty({
    description: '所属团队信息（团队工作空间）',
    type: WorkspaceTeamDto,
    nullable: true,
  })
  team?: WorkspaceTeamDto;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}
