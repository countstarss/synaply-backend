import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import {
  CreateGroupChatDto,
  CreatePrivateChatDto,
} from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddChatMembersDto } from './dto/add-chat-members.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chats')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('group')
  @ApiOperation({ summary: '创建群聊' })
  createGroupChat(
    @Request() req,
    @Body() createGroupChatDto: CreateGroupChatDto,
  ) {
    const creatorId = req.user.teamMemberId;
    return this.chatService.createGroupChat(creatorId, createGroupChatDto);
  }

  @Post('private')
  @ApiOperation({ summary: '创建或获取私聊' })
  createPrivateChat(
    @Request() req,
    @Body() createPrivateChatDto: CreatePrivateChatDto,
  ) {
    const creatorId = req.user.teamMemberId;
    return this.chatService.createPrivateChat(creatorId, createPrivateChatDto);
  }

  @Get()
  @ApiOperation({ summary: '获取当前用户的所有聊天会话' })
  findAllChats(@Request() req, @Query('type') type?: 'private' | 'group') {
    const teamMemberId = req.user.teamMemberId;
    return this.chatService.findAllChats(teamMemberId, type);
  }

  @Get(':chatId')
  @ApiOperation({ summary: '获取单个聊天会话的详细信息' })
  @ApiParam({ name: 'chatId', description: '聊天会话的ID' })
  findOneChat(@Param('chatId') chatId: string) {
    return this.chatService.findOneChat(chatId);
  }

  @Patch(':chatId')
  @ApiOperation({ summary: '更新群聊信息（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  updateChat(
    @Param('chatId') chatId: string,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    return this.chatService.updateChat(chatId, updateChatDto);
  }

  @Delete(':chatId')
  @ApiOperation({ summary: '删除聊天会话（仅限创建者）' })
  @ApiParam({ name: 'chatId', description: '聊天会话的ID' })
  deleteChat(@Param('chatId') chatId: string) {
    return this.chatService.deleteChat(chatId);
  }

  @Post(':chatId/members')
  @ApiOperation({ summary: '向群聊添加新成员（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  addMembersToGroupChat(
    @Param('chatId') chatId: string,
    @Body() addChatMembersDto: AddChatMembersDto,
  ) {
    return this.chatService.addMembersToGroupChat(chatId, addChatMembersDto);
  }

  @Delete(':chatId/members/:teamMemberId')
  @ApiOperation({ summary: '从群聊移除成员（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  @ApiParam({
    name: 'teamMemberId',
    description: '要移除的成员的TeamMember ID',
  })
  removeMemberFromGroupChat(
    @Param('chatId') chatId: string,
    @Param('teamMemberId') teamMemberId: string,
  ) {
    return this.chatService.removeMemberFromGroupChat(chatId, teamMemberId);
  }

  @Post(':chatId/leave')
  @ApiOperation({ summary: '当前用户退出群聊' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  leaveGroupChat(@Request() req, @Param('chatId') chatId: string) {
    const teamMemberId = req.user.teamMemberId;
    return this.chatService.leaveGroupChat(chatId, teamMemberId);
  }
}
