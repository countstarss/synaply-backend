import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceType } from '@prisma/client'; // 导入 WorkspaceType 枚举

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * 同步或创建用户到数据库，并为新用户创建个人工作空间
   * @param userId Supabase 用户 ID
   * @param email 用户邮箱
   * @returns 创建或更新后的用户对象
   */
  async syncUser(userId: string, email: string) {
    return this.prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: email,
        // 为新用户创建个人工作空间
        workspaces: {
          create: {
            name: `${email} 的个人空间`,
            type: WorkspaceType.PERSONAL,
          },
        },
      },
      update: {},
      include: { workspaces: true }, // 包含工作空间信息
    });
  }
}