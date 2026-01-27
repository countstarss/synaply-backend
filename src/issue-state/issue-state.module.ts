import { Module } from '@nestjs/common';
import { IssueStateController } from './issue-state.controller';
import { IssueStateService } from './issue-state.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [IssueStateController],
  providers: [IssueStateService],
  exports: [IssueStateService],
})
export class IssueStateModule {}
