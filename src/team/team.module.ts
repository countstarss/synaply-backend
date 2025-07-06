import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { TeamService } from './team.service';
import { TeamController } from './team.controller';
import { TeamResolver, TeamMemberResolver } from './graphql/team.resolver';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TeamController],
  providers: [TeamService, TeamResolver, TeamMemberResolver],
  exports: [TeamService],
})
export class TeamModule {}
