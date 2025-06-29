import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Workspace } from './workspace.type';

@ObjectType()
export class Project {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => ID)
  workspaceId: string;

  @Field(() => Workspace)
  workspace: Workspace;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
