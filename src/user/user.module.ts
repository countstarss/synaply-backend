import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module'; // 导入 AuthModule

@Module({
  imports: [PrismaModule, AuthModule], // 将 AuthModule 添加到 imports 数组
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService], // 导出 UserService 供其他模块使用
})
export class UserModule {}
