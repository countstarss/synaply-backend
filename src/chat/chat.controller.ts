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

@Controller('chats')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('group')
  createGroupChat(
    @Request() req,
    @Body() createGroupChatDto: CreateGroupChatDto,
  ) {
    const creatorId = req.user.teamMemberId;
    return this.chatService.createGroupChat(creatorId, createGroupChatDto);
  }

  @Post('private')
  createPrivateChat(
    @Request() req,
    @Body() createPrivateChatDto: CreatePrivateChatDto,
  ) {
    const creatorId = req.user.teamMemberId;
    return this.chatService.createPrivateChat(creatorId, createPrivateChatDto);
  }

  @Get()
  findAllChats(@Request() req, @Query('type') type?: 'private' | 'group') {
    const teamMemberId = req.user.teamMemberId;
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
  leaveGroupChat(@Request() req, @Param('chatId') chatId: string) {
    const teamMemberId = req.user.teamMemberId;
    return this.chatService.leaveGroupChat(chatId, teamMemberId);
  }
}
