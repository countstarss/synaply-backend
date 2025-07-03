import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const TeamMemberId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.getType() === 'http'
      ? ctx.switchToHttp().getRequest()
      : GqlExecutionContext.create(ctx).getContext().req;

    // 假设 req.user 包含了认证后的 JWT payload
    // 并且 payload.sub 是 TeamMember 的 ID
    if (request.user && request.user.sub) {
      return request.user.sub;
    }
    // 如果没有认证信息或者没有 sub 字段，可以抛出错误或者返回 null/undefined
    // 这里我们选择抛出 UnauthorizedException，但通常 Guard 会处理这个
    // throw new UnauthorizedException('TeamMember ID not found in token.');
    return null; // 或者根据实际需求返回 undefined
  },
);
