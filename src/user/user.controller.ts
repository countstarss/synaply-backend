import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前登录用户的信息
   * 需要通过 SupabaseAuthGuard 验证 JWT
   * @param req 请求对象，其中包含 Supabase JWT payload (req.user)
   * @returns 当前用户在数据库中的详细信息
   */
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  async getMe(@Req() req) {
    // 从 JWT payload 中获取用户 ID
    const userId = req.user.sub;
    // 从数据库中查找用户详细信息
    const user = await this.userService.findById(userId);
    // 返回用户数据
    return user;
  }
}
