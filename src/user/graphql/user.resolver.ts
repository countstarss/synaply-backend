import { Resolver, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from 'src/auth/supabase-auth.guard';
import { User } from './user.type';
import { UserService } from '../user.service';

@Resolver(() => User)
@UseGuards(SupabaseAuthGuard)
export class UserResolver {
  constructor(private userService: UserService) {}

  // MARK: - 获取当前用户
  @Query(() => User, { name: 'me' })
  async getMe(@Context() ctx) {
    const userId = ctx.req.user.sub;
    return this.userService.findUserById(userId);
  }
}
