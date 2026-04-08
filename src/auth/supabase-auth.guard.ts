import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { verifyJwt } from './verify-jwt';
import { AuthService } from './auth.service';

const getFirstNonEmptyString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 判断请求类型，分别处理 HTTP 和 GraphQL 请求
    const req =
      context.getType() === 'http'
        ? context.switchToHttp().getRequest()
        : GqlExecutionContext.create(context).getContext().req;

    // 获取 Authorization header 中的 token（Bearer xxx）
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      // 没有 token，抛出未授权错误
      throw new UnauthorizedException('Authorization token not found.');
    }

    // 使用自定义工具函数验证 Supabase JWT
    const payload = await verifyJwt(token);

    if (!payload) {
      // 验证失败或过期，抛出未授权错误
      throw new UnauthorizedException('Invalid or expired token.');
    }

    // 将 JWT payload 存入请求对象中，供后续 resolver/controller 使用
    req.user = payload;

    // 若 payload 中包含用户信息，则同步或创建用户
    if (payload.sub && payload.email) {
      const userMetadata =
        payload.user_metadata && typeof payload.user_metadata === 'object'
          ? (payload.user_metadata as Record<string, unknown>)
          : {};

      await this.authService.syncUser(
        payload.sub as string,
        payload.email as string,
        {
          name: getFirstNonEmptyString(
            userMetadata.full_name,
            userMetadata.name,
          ),
          avatarUrl: getFirstNonEmptyString(
            userMetadata.avatar_url,
            userMetadata.picture,
          ),
        },
      );
    }

    return true;
  }
}
