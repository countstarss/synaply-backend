import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiResponse({ status: 200, description: '返回当前登录用户的信息' })
  @ApiResponse({ status: 401, description: '未授权，JWT验证失败' })
  getMe(@Req() req) {
    // req.user 将包含 Supabase JWT 的 payload
    return req.user;
  }
}
