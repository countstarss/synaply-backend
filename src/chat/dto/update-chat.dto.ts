import { PartialType } from '@nestjs/mapped-types';
import { CreateGroupChatDto } from './create-chat.dto';

export class UpdateChatDto extends PartialType(CreateGroupChatDto) {}
