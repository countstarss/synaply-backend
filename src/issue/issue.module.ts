import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from '../common/common.module';
import { IssueService } from './issue.service';
import { IssueResolver } from './graphql/issue.resolver';
import { IssueController } from './issue.controller';
import { IssueStateModule } from '../issue-state/issue-state.module';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule, IssueStateModule],
  controllers: [IssueController],
  providers: [IssueService, IssueResolver],
  exports: [IssueService],
})
export class IssueModule {}
