import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { MessageService } from '../message.service';
import { Message } from './message.model';

@Resolver(() => Message)
@UseGuards(SupabaseAuthGuard)
export class MessageResolver {
  constructor(private messageService: MessageService) {}

  @Query(() => [Message], { name: 'messages' })
  async getMessages(
    @Args('chatId') chatId: string,
    @Args('cursor', { type: () => String, nullable: true }) cursor?: string,
    @Args('limit', { type: () => Number, nullable: true }) limit?: number,
  ) {
    // TODO: Add authorization to ensure user is a member of the chat
    return this.messageService.findMessagesByChatId(chatId, cursor, limit);
  }
}
