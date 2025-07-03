import { Message as PrismaMessage, MessageType } from '@prisma/client';
import { Chat } from '@prisma/client';
import { TeamMember } from '@prisma/client';

export class Message implements PrismaMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: MessageType;
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
