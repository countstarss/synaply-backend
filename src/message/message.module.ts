import { Module } from '@nestjs/common';
import { MessageService } from './message.service';
import { MessageController } from './message.controller';
import { MessageResolver } from './graphql/message.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [MessageService, MessageResolver],
  controllers: [MessageController],
  exports: [MessageService],
})
export class MessageModule {}
