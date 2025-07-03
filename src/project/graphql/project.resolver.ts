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
import { Project } from './project.type';
import { ProjectService } from '../project.service';
import { Issue } from 'src/issue/graphql/issue.type';
import { PrismaService } from 'src/prisma/prisma.service';

@Resolver(() => Project)
@UseGuards(SupabaseAuthGuard)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private prisma: PrismaService,
  ) {}

  @Query(() => Project, { name: 'project', nullable: true })
  async getProjectDetails(
    @Args('projectId', { type: () => ID }) projectId: string,
    @Context() ctx,
  ) {
    const userId = ctx.req.user.sub;
    return this.projectService.findProjectById(projectId, userId);
  }

  // 使用字段解析器来懒加载 Issues 数据
  @ResolveField('issues', () => [Issue])
  async getIssues(@Parent() project: Project) {
    return this.prisma.issue.findMany({
      where: { projectId: project.id },
    });
  }
}
