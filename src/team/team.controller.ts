import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Get,
  Param,
  Patch,
  Delete,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Role } from '@prisma/client';

@UseGuards(SupabaseAuthGuard) // 所有团队相关的接口都需要认证
@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  /**
   * MARK: - 创建团队
   * @param createTeamDto 团队创建 DTO
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的团队信息
   */
  @Post()
  async create(@Body() createTeamDto: CreateTeamDto, @Req() req) {
    const userId = req.user.sub; // 当前用户 ID
    return this.teamService.createTeam(createTeamDto, userId);
  }

  /**
   * MARK: - 邀请加入团队
   * @param teamId 团队 ID
   * @param inviteMemberDto 邀请成员 DTO
   * @param req 请求对象，包含当前用户 ID
   * @returns 邀请结果
   */
  @Post(':teamId/invite')
  async invite(
    @Param('teamId') teamId: string,
    @Body() inviteMemberDto: InviteMemberDto,
    @Req() req,
  ) {
    const inviterId = req.user.sub;
    return this.teamService.inviteMember(teamId, inviteMemberDto, inviterId);
  }

  /**
   * MARK: - 获取团队详情
   * @param teamId 团队 ID
   * @returns 团队详情，包含成员和工作空间
   */
  @Get(':teamId')
  async getTeam(@Param('teamId') teamId: string) {
    return this.teamService.getTeamById(teamId);
  }

  /**
   * MARK: - 所属所有团队
   * NOTE: 获取当前用户所属的所有团队
   * @param req 请求对象，包含当前用户 ID
   * @returns 用户所属团队列表
   */
  @Get()
  async getUserTeams(@Req() req) {
    const userId = req.user.sub;
    return this.teamService.getUserTeams(userId);
  }

  /**
   * MARK: - 更新成员角色
   * @param teamId 团队 ID
   * @param memberId 成员 ID
   * @param role 新角色
   * @param req 请求对象，包含当前用户 ID
   * @returns 更新后的团队成员信息
   */
  @Patch(':teamId/members/:memberId/role')
  async updateMemberRole(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Body('role') role: Role,
    @Req() req,
  ) {
    const currentUserId = req.user.sub;
    return this.teamService.updateMemberRole(
      teamId,
      memberId,
      role,
      currentUserId,
    );
  }

  /**
   * MARK: - 移除团队成员
   * @param teamId 团队 ID
   * @param memberId 被移除成员 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 移除结果
   */
  @Delete(':teamId/members/:memberId')
  async removeMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    const currentUserId = req.user.sub;
    return this.teamService.removeMember(teamId, memberId, currentUserId);
  }
}
