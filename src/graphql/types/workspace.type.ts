import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { WorkspaceType } from '@prisma/client';
import { User } from './user.type';
import { Team } from './team.type';

registerEnumType(WorkspaceType, {
  name: 'WorkspaceType',
  description: '工作空间类型',
});

@ObjectType()
export class Workspace {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => WorkspaceType)
  type: WorkspaceType;

  @Field(() => ID, { nullable: true })
  userId?: string;

  @Field(() => ID, { nullable: true })
  teamId?: string;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Team, { nullable: true })
  team?: Team;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
