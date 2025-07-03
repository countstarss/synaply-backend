import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  // MARK: 创建消息
  async createMessage(
    senderId: string,
    chatId: string,
    createMessageDto: CreateMessageDto,
  ) {
    const { content, type, repliedToMessageId } = createMessageDto;
    // TODO: 验证 senderId 是否为 chatId 的成员
    const message = await this.prisma.message.create({
      data: {
        chat: { connect: { id: chatId } },
        sender: { connect: { id: senderId } },
        content,
        type,
        repliedToMessage: repliedToMessageId
          ? { connect: { id: repliedToMessageId } }
          : undefined,
      },
      include: { sender: true },
    });

    // 更新聊天的 lastMessage
    await this.prisma.chat.update({
      where: { id: chatId },
      data: {
        lastMessageId: message.id,
      },
    });

    return message;
  }

  // MARK: 获取聊天消息
  async findMessagesByChatId(
    chatId: string,
    cursor?: string,
    limit: number = 50,
  ) {
    // TODO: 验证用户是否为该聊天的成员
    return this.prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: cursor ? 1 : 0, // 如果有 cursor，跳过 cursor 本身
      cursor: cursor ? { id: cursor } : undefined,
      include: {
        sender: true,
        repliedToMessage: { include: { sender: true } },
      },
    });
  }

  // MARK: 更新消息
  async updateMessage(messageId: string, updateMessageDto: UpdateMessageDto) {
    // TODO: 验证权限 (只有发送者可以编辑)
    return this.prisma.message.update({
      where: { id: messageId },
      data: { ...updateMessageDto, isEdited: true },
    });
  }

  // MARK: 删除消息
  async deleteMessage(messageId: string) {
    // TODO: 验证权限 (只有发送者可以删除)
    return this.prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: '' }, // 软删除，清空内容
    });
  }

  // MARK: 标记消息为已读
  async markMessageAsRead(
    chatId: string,
    teamMemberId: string,
    messageId: string,
  ) {
    // TODO: 验证 messageId 属于 chatId，并且 teamMemberId 是 chatId 的成员
    return this.prisma.chatMember.update({
      where: {
        chatId_teamMemberId: { chatId, teamMemberId },
      },
      data: {
        lastReadMessageId: messageId,
      },
    });
  }
}
