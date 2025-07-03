import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { Issue } from 'src/issue/graphql/issue.type';
import { IssueService } from '../issue.service';
import { IssueSearchFilters } from 'src/common/graphql/types/query-result.types';

@Resolver(() => Issue)
@UseGuards(SupabaseAuthGuard)
export class IssueResolver {
  constructor(private issueService: IssueService) {}

  @Query(() => [Issue], { name: 'searchIssues' })
  async searchIssues(
    @Args('searchTerm') searchTerm: string,
    @Args('filters', { type: () => IssueSearchFilters, nullable: true })
    filters: IssueSearchFilters,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;
    return this.issueService.searchIssues(userId, searchTerm, filters);
  }

  // 未来可以为 Issue 添加字段解析器，例如解析 comments, activities 等
}
