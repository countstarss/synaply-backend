import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class Workflow {
  @Field(() => ID)
  id: string;
}

@ObjectType()
export class WorkflowStep {
  @Field(() => ID)
  id: string;
}
