import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { MessageType as PrismaMessageType } from '@prisma/client';
import { Chat } from 'src/chat/graphql/chat.model';

// 注册 MessageType 枚举
registerEnumType(PrismaMessageType, {
  name: 'MessageType',
});

@ObjectType()
export class Message {
  @Field(() => ID)
  id: string;

  @Field()
  content: string;

  @Field(() => PrismaMessageType)
  type: PrismaMessageType;

  @Field(() => Chat)
  chat: Chat;

  // 如果需要，可以添加 sender 等更多关联字段
  // @Field(() => TeamMember)
  // sender: TeamMember;

  @Field()
  createdAt: Date;
}
