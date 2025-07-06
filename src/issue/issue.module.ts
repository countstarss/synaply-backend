import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from '../common/common.module';
import { IssueService } from './issue.service';
import { IssueResolver } from './graphql/issue.resolver';
import { IssueController } from './issue.controller';

@Module({
  imports: [PrismaModule, AuthModule, CommonModule],
  controllers: [IssueController],
  providers: [IssueService, IssueResolver],
  exports: [IssueService],
})
export class IssueModule {}
