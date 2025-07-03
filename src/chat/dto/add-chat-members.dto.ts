import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AddChatMembersDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  memberIds: string[];
}
