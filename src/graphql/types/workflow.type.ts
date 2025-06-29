import { ObjectType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { WorkflowStatus } from '@prisma/client';
import { Workspace } from './workspace.type';
import { TeamMember } from './team.type';

registerEnumType(WorkflowStatus, {
  name: 'WorkflowStatus',
  description: '工作流状态',
});

@ObjectType()
export class WorkflowStep {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  order: number;

  @Field(() => ID)
  workflowId: string;

  @Field(() => ID, { nullable: true })
  assigneeId?: string;

  @Field(() => TeamMember, { nullable: true })
  assignee?: TeamMember;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class Workflow {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => WorkflowStatus)
  status: WorkflowStatus;

  @Field(() => ID)
  workspaceId: string;

  @Field(() => Workspace)
  workspace: Workspace;

  @Field(() => [WorkflowStep], { nullable: true })
  steps?: WorkflowStep[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
