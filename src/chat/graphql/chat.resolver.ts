import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { TeamMemberId } from 'src/common/decorators/team-member-id.decorator';
import { ChatService } from '../chat.service';
import { Chat } from './chat.model';
import { ChatType } from '@prisma/client';

@Resolver(() => Chat)
@UseGuards(SupabaseAuthGuard)
export class ChatResolver {
  constructor(private chatService: ChatService) {}

  @Query(() => [Chat], { name: 'chats' })
  async getChats(
    @TeamMemberId() teamMemberId: string,
    @Args('type', { type: () => ChatType, nullable: true })
    type?: 'PRIVATE' | 'GROUP',
  ) {
    // 将 GraphQL 的大写枚举转换为 service 需要的小写字符串
    const typeLower = type?.toLowerCase() as 'private' | 'group' | undefined;
    return this.chatService.findAllChats(teamMemberId, typeLower);
  }

  @Query(() => Chat, { name: 'chat', nullable: true })
  async getChat(@Args('id') id: string) {
    // TODO: Add authorization to ensure user is a member of the chat
    return this.chatService.findOneChat(id);
  }
}
