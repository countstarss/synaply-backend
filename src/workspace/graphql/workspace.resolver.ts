import {
  Resolver,
  Query,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { Workspace } from './workspace.type';
import { WorkspaceService } from '../workspace.service';
import { Team } from 'src/team/graphql/team.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Resolver(() => Workspace)
@UseGuards(SupabaseAuthGuard)
export class WorkspaceResolver {
  constructor(
    private workspaceService: WorkspaceService,
    private prisma: PrismaService,
  ) {}

  @Query(() => [Workspace], { name: 'myWorkspaces' })
  async getMyWorkspaces(@Context() ctx) {
    const userId = ctx.req.user.sub;
    return this.workspaceService.findUserWorkspaces(userId);
  }

  // 使用字段解析器来懒加载 Team 数据
  @ResolveField('team', () => Team, { nullable: true })
  async getTeam(@Parent() workspace: Workspace) {
    if (!workspace.teamId) {
      return null;
    }
    return this.prisma.team.findUnique({
      where: { id: workspace.teamId },
    });
  }
}
