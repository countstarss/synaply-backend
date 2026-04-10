import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TeamModule } from './team/team.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WorkflowModule } from './workflow/workflow.module';
import { IssueModule } from './issue/issue.module';
import { IssueStateModule } from './issue-state/issue-state.module';
import { ProjectModule } from './project/project.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { CommentModule } from './comment/comment.module';
import { CalendarModule } from './calendar/calendar.module';
import { TaskModule } from './task/task.module';
import { DocModule } from './doc/doc.module';
import { InboxModule } from './inbox/inbox.module';
import { AiExecutionModule } from './ai-execution/ai-execution.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      context: ({ req }) => ({ req }),
    }),
    PrismaModule,
    AuthModule,
    CommonModule,
    UserModule,
    TeamModule,
    WorkspaceModule,
    WorkflowModule,
    IssueModule,
    IssueStateModule,
    ProjectModule,
    CommentModule,
    CalendarModule,
    TaskModule,
    DocModule,
    InboxModule,
    AiExecutionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
