import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { ProjectModule } from '../project/project.module';
import { IssueModule } from '../issue/issue.module';
import { DocModule } from '../doc/doc.module';
import { AiExecutionModule } from '../ai-execution/ai-execution.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { AiContextController } from './ai-context.controller';
import { AiContextService } from './ai-context.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CommonModule,
    ProjectModule,
    IssueModule,
    DocModule,
    WorkflowModule,
    AiExecutionModule,
  ],
  controllers: [AiContextController],
  providers: [AiContextService],
  exports: [AiContextService],
})
export class AiContextModule {}
