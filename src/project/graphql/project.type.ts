import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Workspace } from 'src/workspace/graphql/workspace.type';
import { Issue } from 'src/issue/graphql/issue.type';

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

  @Field(() => [Issue])
  issues: Issue[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
