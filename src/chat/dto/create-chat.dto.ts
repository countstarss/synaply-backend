import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateGroupChatDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}

export class CreatePrivateChatDto {
  @IsString()
  @IsNotEmpty()
  targetMemberId: string;
}
