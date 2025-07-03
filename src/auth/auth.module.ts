import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'super-secret-jwt-token-with-at-least-32-characters-long', // 确保与后端 JWT 密钥一致
      signOptions: { expiresIn: '1h' }, // 根据需要设置过期时间
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService, JwtModule], // 导出 AuthService 和 JwtModule，以便 JwtService 可用
})
export class AuthModule {}
