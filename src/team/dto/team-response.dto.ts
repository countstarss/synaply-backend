import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../prisma/generated/prisma/client';
import { WorkspaceDto } from 'src/workspace/dto/workspace-response.dto';

export class UserDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户邮箱' })
  email: string;

  @ApiProperty({ description: '用户名称', nullable: true })
  name?: string;

  @ApiProperty({ description: '用户头像URL', nullable: true })
  avatarUrl?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class TeamMemberDto {
  @ApiProperty({ description: '团队成员ID' })
  id: string;

  @ApiProperty({ description: '团队ID' })
  teamId: string;

  @ApiProperty({ description: '用户ID' })
  userId: string;

  @ApiProperty({ description: '成员角色', enum: Role })
  role: Role;

  @ApiProperty({ description: '用户信息', type: UserDto })
  user: UserDto;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class TeamDto {
  @ApiProperty({ description: '团队ID' })
  id: string;

  @ApiProperty({ description: '团队名称' })
  name: string;

  @ApiProperty({ description: '团队成员列表', type: [TeamMemberDto] })
  members: TeamMemberDto[];

  @ApiProperty({
    description: '团队工作空间',
    type: WorkspaceDto,
    nullable: true,
  })
  workspace?: WorkspaceDto;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}

export class InviteResultDto {
  @ApiProperty({ description: '邀请结果信息' })
  message: string;
}

export class RemoveMemberResultDto {
  @ApiProperty({ description: '移除成员结果信息' })
  message: string;
}
