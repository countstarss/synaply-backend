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
import { TeamMemberService } from '../common/services/team-member.service';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

// 定义聊天响应类型
export interface ChatResponseDto {
  id: string;
  type: 'GROUP' | 'PRIVATE';
  name?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    };
  };
  members: Array<{
    id: string;
    teamMember: {
      id: string;
      user: {
        id: string;
        name: string;
        email: string;
        avatarUrl?: string;
      };
    };
  }>;
}

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chats')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  // MARK: 创建群聊
  @Post('group')
  @ApiOperation({ summary: '创建群聊' })
  @ApiResponse({
    status: 201,
    description: '群聊创建成功',
    type: Object,
  })
  async createGroupChat(
    @Request() req,
    @Body() createGroupChatDto: CreateGroupChatDto,
  ) {
    const userId = req.user.sub;
    // 获取创建者的默认TeamMember ID
    const creatorId =
      await this.teamMemberService.getDefaultTeamMemberId(userId);
    return this.chatService.createGroupChat(creatorId, createGroupChatDto);
  }

  // MARK: 创建或获取私聊
  @Post('private')
  @ApiOperation({ summary: '创建或获取私聊' })
  @ApiResponse({
    status: 201,
    description: '私聊创建成功',
    type: Object,
  })
  async createPrivateChat(
    @Request() req,
    @Body() createPrivateChatDto: CreatePrivateChatDto,
  ) {
    const userId = req.user.sub;
    // 获取创建者的默认TeamMember ID
    const creatorId =
      await this.teamMemberService.getDefaultTeamMemberId(userId);
    return this.chatService.createPrivateChat(creatorId, createPrivateChatDto);
  }

  // MARK: 获取用户所有聊天
  @Get()
  @ApiOperation({ summary: '获取当前用户的所有聊天会话' })
  @ApiQuery({ name: 'type', required: false, description: '聊天类型' })
  @ApiResponse({
    status: 200,
    description: '成功获取聊天列表',
    type: [Object],
  })
  async findAllChats(
    @Request() req,
    @Query('type') type?: 'private' | 'group',
  ) {
    const userId = req.user.sub;
    // 获取用户的默认TeamMember ID
    const teamMemberId =
      await this.teamMemberService.getDefaultTeamMemberId(userId);
    return this.chatService.findAllChats(teamMemberId, type);
  }

  // MARK: 获取单个聊天信息
  @Get(':chatId')
  @ApiOperation({ summary: '获取单个聊天会话的详细信息' })
  @ApiParam({ name: 'chatId', description: '聊天会话的ID' })
  @ApiResponse({
    status: 200,
    description: '成功获取聊天详情',
    type: Object,
  })
  findOneChat(@Param('chatId') chatId: string) {
    return this.chatService.findOneChat(chatId);
  }

  // MARK: 更新群聊信息
  @Patch(':chatId')
  @ApiOperation({ summary: '更新群聊信息（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  @ApiResponse({
    status: 200,
    description: '成功更新群聊',
    type: Object,
  })
  updateChat(
    @Param('chatId') chatId: string,
    @Body() updateChatDto: UpdateChatDto,
  ) {
    return this.chatService.updateChat(chatId, updateChatDto);
  }

  // MARK: 删除聊天会话
  @Delete(':chatId')
  @ApiOperation({ summary: '删除聊天会话（仅限创建者）' })
  @ApiParam({ name: 'chatId', description: '聊天会话的ID' })
  @ApiResponse({
    status: 200,
    description: '成功删除聊天',
    type: Object,
  })
  deleteChat(@Param('chatId') chatId: string) {
    return this.chatService.deleteChat(chatId);
  }

  // MARK: 向群聊添加新成员
  @Post(':chatId/members')
  @ApiOperation({ summary: '向群聊添加新成员（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  @ApiResponse({
    status: 201,
    description: '成功添加成员',
    type: Object,
  })
  addMembersToGroupChat(
    @Param('chatId') chatId: string,
    @Body() addChatMembersDto: AddChatMembersDto,
  ) {
    return this.chatService.addMembersToGroupChat(chatId, addChatMembersDto);
  }

  // MARK: 从群聊移除成员
  @Delete(':chatId/members/:teamMemberId')
  @ApiOperation({ summary: '从群聊移除成员（仅限管理员）' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  @ApiParam({
    name: 'teamMemberId',
    description: '要移除的成员的TeamMember ID',
  })
  @ApiResponse({
    status: 200,
    description: '成功移除成员',
    type: Object,
  })
  removeMemberFromGroupChat(
    @Param('chatId') chatId: string,
    @Param('teamMemberId') teamMemberId: string,
  ) {
    return this.chatService.removeMemberFromGroupChat(chatId, teamMemberId);
  }

  // MARK: 当前用户退出群聊
  @Post(':chatId/leave')
  @ApiOperation({ summary: '当前用户退出群聊' })
  @ApiParam({ name: 'chatId', description: '群聊的ID' })
  @ApiResponse({
    status: 200,
    description: '成功退出群聊',
    type: Object,
  })
  async leaveGroupChat(@Request() req, @Param('chatId') chatId: string) {
    const userId = req.user.sub;
    // 获取用户的默认TeamMember ID
    const teamMemberId =
      await this.teamMemberService.getDefaultTeamMemberId(userId);
    return this.chatService.leaveGroupChat(chatId, teamMemberId);
  }
}
