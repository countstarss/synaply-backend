import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class InviteMemberDto {
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string; // 被邀请成员的邮箱
}
