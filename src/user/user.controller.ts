import { Controller, Get, Req, UseGuards, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { UserService, PublicUser } from './user.service';

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * MARK: - 获取当前用户详细信息
   * GET /users/me
   * @summary 获取当前认证用户的详细信息
   * @description 通过验证请求头中的JWT，从数据库中返回当前用户的详细信息。
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

  /**
   * MARK: - 根据用户ID获取公开用户信息
   * GET /users/:userId
   * @summary 获取指定用户的公开信息
   * @description 根据用户ID返回该用户的公开信息，不包含敏感数据如邮箱等
   * @param userId 用户ID
   * @returns 用户的公开信息
   */
  @UseGuards(SupabaseAuthGuard)
  @Get(':userId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '根据用户ID获取公开用户信息' })
  @ApiParam({ name: 'userId', description: '用户ID', type: 'string' })
  @ApiResponse({
    status: 200,
    description: '返回用户公开信息',
  })
  @ApiResponse({ status: 401, description: '未授权，JWT验证失败' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async getUserById(@Param('userId') userId: string): Promise<PublicUser> {
    // 获取用户公开信息
    const user = await this.userService.findPublicUserById(userId);
    return user;
  }
}
