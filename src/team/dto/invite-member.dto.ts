import { IsString, IsNotEmpty, IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({
    description: 'The email of the member to invite',
    example: 'luke@wizlab.org',
  })
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string; // 被邀请成员的邮箱
}
