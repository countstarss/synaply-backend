import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ProjectModule } from '../project/project.module';
import { IssueModule } from '../issue/issue.module';
import { DocModule } from '../doc/doc.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { CommentModule } from '../comment/comment.module';
import { IssueStateModule } from '../issue-state/issue-state.module';
import { AiExecutionController } from './ai-execution.controller';
import { AiExecutionService } from './ai-execution.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CommonModule,
    ProjectModule,
    IssueModule,
    DocModule,
    WorkflowModule,
    CommentModule,
    IssueStateModule,
  ],
  controllers: [AiExecutionController],
  providers: [AiExecutionService],
  exports: [AiExecutionService],
})
export class AiExecutionModule {}
