import {
  Resolver,
  Query,
  ResolveField,
  Parent,
  Args,
  ID,
  Context,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { Team, TeamMember } from './team.type';
import { TeamService } from '../team.service';
import { TeamMemberWorkload } from 'src/common/graphql/types/query-result.types';

@Resolver(() => Team)
@UseGuards(SupabaseAuthGuard)
export class TeamResolver {
  constructor(private teamService: TeamService) {}

  @Query(() => [TeamMemberWorkload], { name: 'teamWorkload' })
  async getTeamWorkload(
    @Args('teamId', { type: () => ID }) teamId: string,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;
    void teamId;
    void userId;
  }

  @ResolveField('members', () => [TeamMember])
  async getMembers(@Parent() team: Team) {
    return this.teamService.getTeamMembers(team.id);
  }
}

@Resolver(() => TeamMember)
export class TeamMemberResolver {
  // 如果 TeamMember 内部有需要单独解析的复杂字段，可以在这里添加
}
