import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@Controller('chats/:chatId/messages')
@UseGuards(SupabaseAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post()
  createMessage(
    @Request() req,
    @Param('chatId') chatId: string,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    const senderId = req.user.teamMemberId;
    // 修复参数顺序：正确的应该是 (senderId, chatId, dto)
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
    // Note: This method in the service doesn't perform auth checks,
    // but the Guard protects the route.
    return this.messageService.findMessagesByChatId(chatId, cursor, limit);
  }

  @Patch(':messageId')
  updateMessage(
    @Param('messageId') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    // @Request() req, // teamMemberId check should be in service
  ) {
    // const teamMemberId = req.user.teamMemberId;
    return this.messageService.updateMessage(messageId, updateMessageDto);
  }

  @Delete(':messageId')
  deleteMessage(
    @Param('messageId') messageId: string,
    // @Request() req, // teamMemberId check should be in service
  ) {
    // const teamMemberId = req.user.teamMemberId;
    return this.messageService.deleteMessage(messageId);
  }

  @Post(':messageId/read')
  markMessageAsRead(
    @Request() req,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    const teamMemberId = req.user.teamMemberId;
    return this.messageService.markMessageAsRead(
      chatId,
      teamMemberId,
      messageId,
    );
  }
}
