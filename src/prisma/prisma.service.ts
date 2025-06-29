import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect(); // 连接到数据库
  }

  async onModuleDestroy() {
    await this.$disconnect(); // 在应用关闭前断开数据库连接
  }
}
