import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { AiMessageRole } from '../../../prisma/generated/prisma/client';

/**
 * 给一个 thread 追加一条消息。
 *
 * 注意：这个端点是 Next.js runtime 写线程历史用的，不是用户直接的入口。
 * 用户发起对话走的是 `POST /ai/threads/:id/messages`（在 Next 那一层）；
 * Next runtime 在 tool loop 期间用本接口把每一条 user/assistant/tool 消息落库。
 */
export class AppendMessageDto {
  @ApiProperty({ enum: AiMessageRole })
  @IsEnum(AiMessageRole)
  role!: AiMessageRole;

  @ApiProperty({
    description:
      '消息的 parts 富结构 JSON（参考 ai-thread.types.ts AiMessagePart）',
    type: 'array',
  })
  @IsArray()
  parts!: unknown[];

  @ApiProperty({
    description: '关联的 run ID（若由某次 run 产生）',
    required: false,
  })
  @IsOptional()
  @IsString()
  runId?: string;
}
