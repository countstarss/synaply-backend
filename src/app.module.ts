import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TeamModule } from './team/team.module';
import { WorkspaceModule } from './workspace/workspace.module'; // 导入 WorkspaceModule

@Module({
  imports: [PrismaModule, AuthModule, UserModule, TeamModule, WorkspaceModule], // 将 WorkspaceModule 添加到 imports 数组
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
