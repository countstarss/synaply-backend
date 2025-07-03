import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { WorkspaceType as PrismaWorkspaceType } from '@prisma/client';
import { User } from 'src/user/graphql/user.model';
import { Team } from 'src/team/graphql/team.model';

registerEnumType(PrismaWorkspaceType, {
  name: 'WorkspaceType',
  description: '工作空间类型',
});

@ObjectType()
export class Workspace {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => PrismaWorkspaceType)
  type: PrismaWorkspaceType;

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
