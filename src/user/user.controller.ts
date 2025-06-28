import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserService } from './user.service';

@ApiTags('users')
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前用户详细信息' })
  @ApiResponse({ status: 200, description: '返回当前用户在数据库中的详细信息' })
  @ApiResponse({ status: 401, description: '未授权，JWT验证失败' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async getMe(@Req() req) {
    // 从 JWT payload 中获取用户 ID
    const userId = req.user.sub;
    // 从数据库中查找用户详细信息
    const user = await this.userService.findById(userId);
    // 返回用户数据
    return user;
  }
}
