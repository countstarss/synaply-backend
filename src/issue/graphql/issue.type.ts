import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { IssueStatus, IssuePriority } from '@prisma/client';
import { Workspace } from 'src/workspace/graphql/workspace.type';
import { Project } from 'src/project/graphql/project.type';
import { TeamMember } from 'src/team/graphql/team.model';
import { Workflow, WorkflowStep } from 'src/workflow/graphql/workflow.type';

registerEnumType(IssueStatus, {
  name: 'IssueStatus',
  description: '任务状态',
});

registerEnumType(IssuePriority, {
  name: 'IssuePriority',
  description: '任务优先级',
});

@ObjectType()
class Comment {
  @Field(() => ID) id: string;
}
@ObjectType()
class IssueActivity {
  @Field(() => ID) id: string;
}
@ObjectType()
class IssueDependency {
  @Field(() => ID) id: string;
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
