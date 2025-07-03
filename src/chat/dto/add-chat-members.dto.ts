import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddChatMembersDto {
  @ApiProperty({
    description: '要添加到群聊的TeamMember ID列表',
    type: [String],
    example: ['uuid-of-new-member-1', 'uuid-of-new-member-2'],
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}
