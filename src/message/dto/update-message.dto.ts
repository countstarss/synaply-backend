import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreateMessageDto } from './create-message.dto';

export class UpdateMessageDto extends PartialType(CreateMessageDto) {
  @ApiPropertyOptional({ description: '要更新的消息内容' })
  content?: string;
}
