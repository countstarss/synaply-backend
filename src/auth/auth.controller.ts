import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Controller('auth')
export class AuthController {
  @UseGuards(SupabaseAuthGuard)
  @Get('me')
  getMe(@Req() req) {
    // req.user 将包含 Supabase JWT 的 payload
    return req.user;
  }
}
