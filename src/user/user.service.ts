import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * MARK: - 根据 ID 查找用户
   * @description
   * 思考过程:
   * 1. 目标: 根据用户 ID 获取用户详细信息，包括其关联的工作空间。
   * 2. 策略: 使用 Prisma 的 `findUnique` 方法，并通过 `include` 选项加载 `workspaces` 关系。
   * 3. 考虑: 如果用户不存在，返回 `null`，由调用方处理 `NotFoundException`。
   * @param id 用户 ID
   * @returns 用户对象或 null
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { workspaces: true }, // 包含工作空间信息
    });
  }

  /**
   * MARK: - 更新用户信息
   * @description
   * 思考过程:
   * 1. 目标: 更新指定用户的部分或全部信息。
   * 2. 策略: 使用 Prisma 的 `update` 方法，根据用户 ID 更新数据。
   * 3. 考虑: 如果用户不存在，Prisma 会抛出错误，由调用方捕获。
   * @param id 用户 ID
   * @param data 更新数据
   * @returns 更新后的用户对象
   */
  async update(id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * MARK: - 根据 ID 获取用户 (带 NotFoundException)
   * @description
   * 思考过程:
   * 1. 目标: 根据用户 ID 获取用户，如果用户不存在则抛出 `NotFoundException`。
   * 2. 策略: 使用 Prisma 的 `findUnique` 方法，并在结果为 `null` 时手动抛出异常。
   * 3. 考虑: 适用于那些必须确保用户存在的场景，避免在控制器中重复检查。
   * @param id 用户 ID
   * @returns 用户对象
   */
  async findUserById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
