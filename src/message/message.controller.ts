import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TeamMemberId } from '../common/decorators/team-member-id.decorator';

@Controller('chats/:chatId/messages')
@UseGuards(SupabaseAuthGuard) // 使用 SupabaseAuthGuard
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  createMessage(
    @TeamMemberId() senderId: string,
    @Param('chatId') chatId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messageService.createMessage(
      senderId,
      chatId,
      createMessageDto,
    );
  }

  @Get()
  findMessagesByChatId(
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    return this.messageService.findMessagesByChatId(chatId, cursor, limit);
  }

  @Patch(':messageId')
  updateMessage(
    @Param('messageId') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
  ) {
    return this.messageService.updateMessage(messageId, updateMessageDto);
  }

  @Delete(':messageId')
  deleteMessage(@Param('messageId') messageId: string) {
    return this.messageService.deleteMessage(messageId);
  }

  @Post(':messageId/read')
  markMessageAsRead(
    @Param('chatId') chatId: string,
    @TeamMemberId() teamMemberId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messageService.markMessageAsRead(
      chatId,
      teamMemberId,
      messageId,
    );
  }
}
