import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { ChatType as PrismaChatType } from '@prisma/client';

// 让 Prisma 的 ChatType 枚举可以在 GraphQL 中使用
registerEnumType(PrismaChatType, {
  name: 'ChatType',
});

@ObjectType()
export class Chat {
  @Field(() => ID)
  id: string;

  @Field(() => PrismaChatType)
  type: PrismaChatType;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
