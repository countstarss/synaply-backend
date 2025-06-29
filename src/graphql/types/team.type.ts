import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { Role } from '@prisma/client';
import { User } from './user.type';

registerEnumType(Role, {
  name: 'Role',
  description: '团队成员角色',
});

@ObjectType()
export class TeamMember {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  teamId: string;

  @Field(() => ID)
  userId: string;

  @Field(() => Role)
  role: Role;

  @Field(() => User)
  user: User;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class Team {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field(() => [TeamMember], { nullable: true })
  members?: TeamMember[];

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
