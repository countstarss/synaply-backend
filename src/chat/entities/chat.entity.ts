import {
  Chat as PrismaChat,
  ChatType,
  ChatMember as PrismaChatMember,
  Message as PrismaMessage,
} from '@prisma/client';
import { TeamMember } from '@prisma/client';

export class Chat implements PrismaChat {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastMessageId: string | null;
  creatorId: string;

  members?: ChatMember[];
  messages?: Message[];
  lastMessage?: Message;
  creator?: TeamMember;
}

export class ChatMember implements PrismaChatMember {
  id: string;
  chatId: string;
  teamMemberId: string;
  joinedAt: Date;
  lastReadMessageId: string | null;
  isAdmin: boolean;

  chat?: Chat;
  teamMember?: TeamMember;
  lastReadMessage?: Message;
}

export class Message implements PrismaMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  createdAt: Date;
  updatedAt: Date;
  isEdited: boolean;
  isDeleted: boolean;
  repliedToMessageId: string | null;

  chat?: Chat;
  sender?: TeamMember;
  repliedToMessage?: Message;
  replies?: Message[];
}
