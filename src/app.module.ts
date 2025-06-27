import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module'; // 导入 UserModule

@Module({
  imports: [PrismaModule, AuthModule, UserModule], // 将 UserModule 添加到 imports 数组
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
