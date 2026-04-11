import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AiThreadController } from './ai-thread.controller';
import { AiThreadService } from './ai-thread.service';
import { AiThreadCron } from './ai-thread.cron';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [AiThreadController],
  providers: [AiThreadService, AiThreadCron],
  exports: [AiThreadService],
})
export class AiThreadModule {}
