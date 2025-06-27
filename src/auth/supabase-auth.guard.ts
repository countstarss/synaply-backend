import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyJwt } from './verify-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedException('Authorization token not found.');
    }

    const payload = await verifyJwt(token);

    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    // 将 Supabase JWT payload 附加到请求对象
    req.user = payload;

    // 同步或创建用户到数据库
    if (payload.sub && payload.email) {
      await this.authService.syncUser(
        payload.sub as string,
        payload.email as string,
      );
    }

    return true;
  }
}
