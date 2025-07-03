import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMinSize,
} from 'class-validator';

export class CreateGroupChatDto {
  @ApiProperty({ description: '群聊名称', example: '产品设计讨论组' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '群聊描述',
    required: false,
    example: '关于V2版本UI/UX的讨论',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: '群聊成员的TeamMember ID列表',
    type: [String],
    example: ['uuid-of-member-1', 'uuid-of-member-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}

export class CreatePrivateChatDto {
  @ApiProperty({
    description: '私聊对象的TeamMember ID',
    example: 'uuid-of-target-member',
  })
  @IsString()
  @IsNotEmpty()
  targetMemberId: string;
}
