import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * 同步或创建用户到数据库
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
      },
      update: {},
    });
  }
}
