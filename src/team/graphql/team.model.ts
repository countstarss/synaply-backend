import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Team {
  @Field(() => ID)
  id: string;
}

@ObjectType()
export class TeamMember {
  @Field(() => ID)
  id: string;
}
