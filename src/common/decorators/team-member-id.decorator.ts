import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const TeamMemberId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.getType() === 'http'
      ? ctx.switchToHttp().getRequest()
      : GqlExecutionContext.create(ctx).getContext().req;

    if (request.user && request.user.sub) {
      return request.user.sub; // 返回 Supabase User ID
    }
    return null;
  },
);