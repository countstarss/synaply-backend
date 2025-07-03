import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { MessageType } from '@prisma/client';

export class CreateMessageDto {
  @ApiProperty({ description: '消息内容', example: '你好，明天会议时间不变。' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: '消息类型',
    enum: MessageType,
    example: MessageType.TEXT,
  })
  @IsEnum(MessageType)
  type: MessageType;

  @ApiPropertyOptional({
    description: '回复的消息ID',
    example: 'uuid-of-message-to-reply',
  })
  @IsString()
  @IsOptional()
  repliedToMessageId?: string;
}
