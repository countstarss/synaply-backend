import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IssueStatus, IssuePriority } from '@prisma/client';
import { Workspace } from './workspace.type';
import { Project } from './project.type';
import { TeamMember } from './team.type';
import { Workflow, WorkflowStep } from './workflow.type';

registerEnumType(IssueStatus, {
  name: 'IssueStatus',
  description: '任务状态',
});

registerEnumType(IssuePriority, {
  name: 'IssuePriority',
  description: '任务优先级',
});

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => ID)
  issueId: string;

  @Field(() => ID)
  authorId: string;

  @Field(() => TeamMember)
  author: TeamMember;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class IssueActivity {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  issueId: string;

  @Field(() => ID)
  actorId: string;

  @Field(() => TeamMember)
  actor: TeamMember;

  @Field({ nullable: true })
  fromStepName?: string;

  @Field()
  toStepName: string;

  @Field({ nullable: true })
  comment?: string;

  @Field()
  createdAt: Date;
}


@ObjectType()
export class Issue {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => IssueStatus)
  status: IssueStatus;

  @Field(() => IssuePriority)
  priority: IssuePriority;

  @Field({ nullable: true })
  dueDate?: Date;

  @Field({ nullable: true })
  startDate?: Date;

  @Field(() => ID)
  workspaceId: string;

  @Field(() => Workspace)
  workspace: Workspace;

  @Field(() => ID, { nullable: true })
  projectId?: string;

  @Field(() => Project, { nullable: true })
  project?: Project;

  @Field(() => ID, { nullable: true })
  workflowId?: string;

  @Field(() => Workflow, { nullable: true })
  workflow?: Workflow;

  @Field(() => ID, { nullable: true })
  currentStepId?: string;

  @Field(() => WorkflowStep, { nullable: true })
  currentStep?: WorkflowStep;

  @Field(() => ID, { nullable: true })
  directAssigneeId?: string;

  @Field(() => TeamMember, { nullable: true })
  directAssignee?: TeamMember;

  @Field(() => ID)
  creatorId: string;

  @Field(() => TeamMember)
  creator: TeamMember;

  @Field(() => ID, { nullable: true })
  parentTaskId?: string;

  @Field(() => Issue, { nullable: true })
  parentTask?: Issue;

  @Field(() => [Issue], { nullable: true })
  subtasks?: Issue[];

  @Field(() => [IssueActivity], { nullable: true })
  activities?: IssueActivity[];

  @Field(() => [Comment], { nullable: true })
  comments?: Comment[];

  @Field(() => [IssueDependency], { nullable: true })
  blockingIssues?: IssueDependency[];

  @Field(() => [IssueDependency], { nullable: true })
  dependsOnIssues?: IssueDependency[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}


@ObjectType()
export class IssueDependency {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  blockerIssueId: string;

  @Field(() => ID)
  dependsOnIssueId: string;

  @Field(() => Issue, { nullable: true })
  blockerIssue?: Issue;

  @Field(() => Issue, { nullable: true })
  dependsOnIssue?: Issue;

  @Field()
  createdAt: Date;
}