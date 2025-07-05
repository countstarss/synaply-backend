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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Message')
@ApiBearerAuth()
@Controller('chats/:chatId/messages')
@UseGuards(SupabaseAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // MARK: 在指定聊天中发送消息
  @Post()
  @ApiOperation({ summary: '在指定聊天中发送消息' })
  @ApiParam({ name: 'chatId', description: '目标聊天的ID' })
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

  // MARK: 获取指定聊天的消息列表
  // NOTE: （分页）
  @Get()
  @ApiOperation({ summary: '获取指定聊天的消息列表（分页）' })
  @ApiParam({ name: 'chatId', description: '目标聊天的ID' })
  findMessagesByChatId(
    @Param('chatId') chatId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: number,
  ) {
    // Note: This method in the service doesn't perform auth checks,
    // but the Guard protects the route.
    return this.messageService.findMessagesByChatId(chatId, cursor, limit);
  }

  // MARK: 编辑已发送的消息
  @Patch(':messageId')
  @ApiOperation({ summary: '编辑已发送的消息（仅限发送者）' })
  @ApiParam({ name: 'chatId', description: '消息所在聊天的ID' })
  @ApiParam({ name: 'messageId', description: '要编辑的消息的ID' })
  updateMessage(
    @Param('messageId') messageId: string,
    @Body() updateMessageDto: UpdateMessageDto,
    // @Request() req, // teamMemberId check should be in service
  ) {
    // const teamMemberId = req.user.teamMemberId;
    return this.messageService.updateMessage(messageId, updateMessageDto);
  }

  // MARK: 删除已发送的消息
  @Delete(':messageId')
  @ApiOperation({ summary: '删除已发送的消息（仅限发送者，软删除）' })
  @ApiParam({ name: 'chatId', description: '消息所在聊天的ID' })
  @ApiParam({ name: 'messageId', description: '要删除的消息的ID' })
  deleteMessage(
    @Param('messageId') messageId: string,
    // @Request() req, // teamMemberId check should be in service
  ) {
    // const teamMemberId = req.user.teamMemberId;
    return this.messageService.deleteMessage(messageId);
  }

  // MARK: 将消息标记为已读
  @Post(':messageId/read')
  @ApiOperation({ summary: '将消息标记为已读' })
  @ApiParam({ name: 'chatId', description: '消息所在聊天的ID' })
  @ApiParam({ name: 'messageId', description: '最后一条已读消息的ID' })
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
