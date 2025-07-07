import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateGroupChatDto,
  CreatePrivateChatDto,
} from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { AddChatMembersDto } from './dto/add-chat-members.dto';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // MARK: 创建群聊
  /**
   * INFO: 当创建群聊的时候, 首先需要memberIds 是否有效，并且 creatorId 必须在 memberIds 中
   * 其次需要验证 memberIds 是否存在，并且 memberIds 中不能有重复的id
   * 最后需要验证 memberIds 中是否存在 creatorId
   * 如果以上条件都满足，则创建群聊
   * 如果以上条件不满足，则抛出错误
   * 创建的时候, 类型为 GROUP,name可以自动生成, 后续可以改
   * 添加创建者信息, 并且默认是管理员
   */

  async createGroupChat(
    creatorId: string,
    createGroupChatDto: CreateGroupChatDto,
  ) {
    const { name, description, memberIds } = createGroupChatDto;
    // TODO: 验证 memberIds 是否有效，并且 creatorId 必须在 memberIds 中
    return this.prisma.chat.create({
      data: {
        type: 'GROUP',
        name,
        description,
        creator: { connect: { id: creatorId } },
        members: {
          create: memberIds.map((memberId) => ({
            teamMember: { connect: { id: memberId } },
            isAdmin: memberId === creatorId, // 创建者默认为管理员
          })),
        },
      },
      include: { members: { include: { teamMember: true } } },
    });
  }

  // MARK: 创建私聊
  /**
   * INFO: 当创建私聊的时候, 首先需要验证 targetMemberId 是否有效
   * 其次需要验证 creatorId 和 targetMemberId 是否存在
   * 最后需要验证 creatorId 和 targetMemberId 是否已经存在私聊, 如果存在, 则返回已存在的私聊
   * 如果以上条件都满足，则创建私聊
   * 如果以上条件不满足，则抛出错误
   * 创建的时候, 类型为 PRIVATE, 并且 creatorId 必须在 members 中
   */
  async createPrivateChat(
    creatorId: string,
    createPrivateChatDto: CreatePrivateChatDto,
  ) {
    const { targetMemberId } = createPrivateChatDto;

    // 检查是否已存在私聊
    const existingChat = await this.prisma.chat.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          {
            members: {
              some: {
                teamMemberId: creatorId,
              },
            },
          },
          {
            members: {
              some: {
                teamMemberId: targetMemberId,
              },
            },
          },
        ],
        // 确保聊天只有这两个成员
        members: {
          every: {
            teamMemberId: { in: [creatorId, targetMemberId] },
          },
        },
      },
      include: { members: { include: { teamMember: true } } },
    });

    if (existingChat) {
      // 验证聊天确实只有两个成员
      if (existingChat.members.length === 2) {
        return existingChat;
      }
    }

    // 创建新的私聊
    return this.prisma.chat.create({
      data: {
        type: 'PRIVATE',
        creator: { connect: { id: creatorId } },
        members: {
          create: [
            { teamMember: { connect: { id: creatorId } } },
            { teamMember: { connect: { id: targetMemberId } } },
          ],
        },
      },
      include: { members: { include: { teamMember: true } } },
    });
  }

  // MARK: 获取所有聊天
  async findAllChats(teamMemberId: string, type?: 'private' | 'group') {
    return this.prisma.chat.findMany({
      where: {
        members: {
          some: { teamMemberId: teamMemberId },
        },
        type: type === 'private' ? 'PRIVATE' : 'GROUP',
      },
      include: {
        lastMessage: { include: { sender: true } },
        members: { include: { teamMember: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  // MARK: 获取单个聊天
  async findOneChat(chatId: string) {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: { include: { teamMember: true } },
        creator: true,
      },
    });
  }

  // MARK: 更新聊天
  async updateChat(chatId: string, updateChatDto: UpdateChatDto) {
    return this.prisma.chat.update({
      where: { id: chatId },
      data: updateChatDto,
    });
  }

  // MARK: 删除聊天
  async deleteChat(chatId: string) {
    // TODO: 验证权限
    return this.prisma.chat.delete({
      where: { id: chatId },
    });
  }

  // MARK: 添加群聊成员
  async addMembersToGroupChat(
    chatId: string,
    addChatMembersDto: AddChatMembersDto,
  ) {
    const { memberIds } = addChatMembersDto;
    // TODO: 验证 chat 类型是否为 GROUP，验证权限
    return this.prisma.chat.update({
      where: { id: chatId },
      data: {
        members: {
          create: memberIds.map((memberId) => ({
            teamMember: { connect: { id: memberId } },
          })),
        },
      },
      include: { members: { include: { teamMember: true } } },
    });
  }

  // MARK: 移除群聊成员
  async removeMemberFromGroupChat(chatId: string, teamMemberId: string) {
    // TODO: 验证 chat 类型是否为 GROUP，验证权限
    return this.prisma.chatMember.delete({
      where: {
        chatId_teamMemberId: { chatId, teamMemberId },
      },
    });
  }

  // MARK: 离开群聊
  async leaveGroupChat(chatId: string, teamMemberId: string) {
    // TODO: 验证 chat 类型是否为 GROUP，验证权限
    return this.prisma.chatMember.delete({
      where: {
        chatId_teamMemberId: { chatId, teamMemberId },
      },
    });
  }
}
