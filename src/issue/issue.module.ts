import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { IssueService } from './issue.service';
import { IssueResolver } from './graphql/issue.resolver';
import { IssueController } from './issue.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [IssueController],
  providers: [IssueService, IssueResolver],
  exports: [IssueService],
})
export class IssueModule {}
