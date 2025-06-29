import { ObjectType, Field, InputType, Int, ID } from '@nestjs/graphql';
import { IssueStatus, IssuePriority } from '@prisma/client';
import { Project } from './project.type';
import { Issue } from './issue.type';
import { TeamMember } from './team.type';

// 输入类型定义
@InputType()
export class IssueSearchFilters {
  @Field(() => IssueStatus, { nullable: true })
  status?: IssueStatus;

  @Field(() => IssuePriority, { nullable: true })
  priority?: IssuePriority;

  @Field(() => ID, { nullable: true })
  assigneeId?: string;

  @Field(() => ID, { nullable: true })
  projectId?: string;

  @Field(() => ID, { nullable: true })
  workspaceId?: string;
}

// 输出类型定义
@ObjectType()
export class StatusCount {
  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class PriorityCount {
  @Field(() => IssuePriority)
  priority: IssuePriority;

  @Field(() => Int)
  count: number;
}

@ObjectType()
export class WorkspaceStats {
  @Field(() => ID)
  workspaceId: string;

  @Field(() => Int)
  totalProjects: number;

  @Field(() => Int)
  totalIssues: number;

  @Field(() => [StatusCount])
  issuesByStatus: StatusCount[];

  @Field(() => [PriorityCount])
  issuesByPriority: PriorityCount[];

  @Field(() => Int)
  overdueIssues: number;

  @Field(() => [Issue])
  upcomingDeadlines: Issue[];

  @Field(() => Int)
  teamMembersCount: number;
}

@ObjectType()
export class DependencyNode {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => IssuePriority)
  priority: IssuePriority;
}

@ObjectType()
export class DependencyEdge {
  @Field(() => ID)
  from: string;

  @Field(() => ID)
  to: string;

  @Field()
  type: string;
}

@ObjectType()
export class DependencyGraph {
  @Field(() => [DependencyNode])
  nodes: DependencyNode[];

  @Field(() => [DependencyEdge])
  edges: DependencyEdge[];
}

@ObjectType()
export class ProjectDetails extends Project {
  @Field(() => [Issue])
  issues: Issue[];

  @Field(() => DependencyGraph)
  dependencyGraph: DependencyGraph;
}

@ObjectType()
export class TeamMemberWorkload {
  @Field(() => TeamMember)
  member: TeamMember;

  @Field(() => Int)
  todoCount: number;

  @Field(() => Int)
  inProgressCount: number;

  @Field(() => Int)
  blockedCount: number;

  @Field(() => Int)
  overdueCount: number;

  @Field(() => Int)
  totalActiveIssues: number;
}
