import { ObjectType, Field, InputType, Int, ID } from '@nestjs/graphql';
import { IssueStatus, IssuePriority } from '@prisma/client';
import { TeamMember } from 'src/team/graphql/team.type';

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
