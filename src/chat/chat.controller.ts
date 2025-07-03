import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateGroupChatDto, CreatePrivateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddChatMembersDto } from './dto/add-chat-members.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TeamMemberId } from '../common/decorators/team-member-id.decorator';

@Controller('chats')
@UseGuards(SupabaseAuthGuard) // 使用 SupabaseAuthGuard
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('group')
  createGroupChat(
    @TeamMemberId() creatorId: string,
    @Body() createGroupChatDto: CreateGroupChatDto,
  ) {
    return this.chatService.createGroupChat(creatorId, createGroupChatDto);
  }

  @Post('private')
  createPrivateChat(
    @TeamMemberId() creatorId: string,
    @Body() createPrivateChatDto: CreatePrivateChatDto,
  ) {
    return this.chatService.createPrivateChat(creatorId, createPrivateChatDto);
  }

  @Get()
  findAllChats(
    @TeamMemberId() teamMemberId: string,
    @Query('type') type?: 'private' | 'group',
  ) {
    return this.chatService.findAllChats(teamMemberId, type);
  }

  @Get(':chatId')
  findOneChat(@Param('chatId') chatId: string) {
    return this.chatService.findOneChat(chatId);
  }

  @Patch(':chatId')
  updateChat(
    @Param('chatId') chatId: string,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    return this.chatService.updateChat(chatId, updateChatDto);
  }

  @Delete(':chatId')
  deleteChat(@Param('chatId') chatId: string) {
    return this.chatService.deleteChat(chatId);
  }

  @Post(':chatId/members')
  addMembersToGroupChat(
    @Param('chatId') chatId: string,
    @Body() addChatMembersDto: AddChatMembersDto,
  ) {
    return this.chatService.addMembersToGroupChat(chatId, addChatMembersDto);
  }

  @Delete(':chatId/members/:teamMemberId')
  removeMemberFromGroupChat(
    @Param('chatId') chatId: string,
    @Param('teamMemberId') teamMemberId: string,
  ) {
    return this.chatService.removeMemberFromGroupChat(chatId, teamMemberId);
  }

  @Post(':chatId/leave')
  leaveGroupChat(
    @Param('chatId') chatId: string,
    @TeamMemberId() teamMemberId: string,
  ) {
    return this.chatService.leaveGroupChat(chatId, teamMemberId);
  }
}
