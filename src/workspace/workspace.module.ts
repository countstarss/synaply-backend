import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceService } from './workspace.service';
import { WorkspaceResolver } from './graphql/workspace.resolver';
import { AuthModule } from 'src/auth/auth.module';
import { WorkspaceController } from './workspace.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceResolver],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
