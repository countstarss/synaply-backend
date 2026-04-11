import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { AiContextController } from './ai-context.controller';
import { AiContextService } from './ai-context.service';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [AiContextController],
  providers: [AiContextService],
  exports: [AiContextService],
})
export class AiContextModule {}
