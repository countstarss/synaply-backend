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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import {
  TeamDto,
  TeamMemberDto,
  InviteResultDto,
  RemoveMemberResultDto,
} from './dto/team-response.dto';

@ApiTags('teams')
@ApiBearerAuth()
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
  @ApiOperation({
    summary: '创建团队',
    description:
      '创建新团队，创建者自动成为团队拥有者，并创建对应的团队工作空间',
  })
  @ApiBody({ type: CreateTeamDto })
  @ApiResponse({
    status: 201,
    description: '团队创建成功',
    type: TeamDto,
  })
  @ApiResponse({ status: 400, description: '团队名称已存在或请求参数错误' })
  @ApiResponse({ status: 401, description: '未授权访问' })
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
  @ApiOperation({
    summary: '邀请成员加入团队',
    description: '只有团队的OWNER或ADMIN可以邀请新成员',
  })
  @ApiParam({ name: 'teamId', description: '团队ID' })
  @ApiBody({ type: InviteMemberDto })
  @ApiResponse({
    status: 201,
    description: '成员邀请成功',
    type: InviteResultDto,
  })
  @ApiResponse({ status: 400, description: '用户已是团队成员或无权限邀请' })
  @ApiResponse({ status: 404, description: '被邀请用户不存在' })
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
  @ApiOperation({
    summary: '获取团队详情',
    description: '获取指定团队的详细信息，包括成员列表和工作空间信息',
  })
  @ApiParam({ name: 'teamId', description: '团队ID' })
  @ApiResponse({
    status: 200,
    description: '获取团队详情成功',
    type: TeamDto,
  })
  @ApiResponse({ status: 404, description: '团队不存在' })
  async getTeam(@Param('teamId') teamId: string) {
    return this.teamService.getTeamById(teamId);
  }

  /**
   * MARK: - 获取团队成员列表
   * @param teamId 团队 ID
   * @returns 团队成员列表
   */
  @Get(':teamId/members')
  @ApiOperation({
    summary: '获取团队成员列表',
    description: '获取指定团队的所有成员信息',
  })
  @ApiParam({ name: 'teamId', description: '团队ID' })
  @ApiResponse({
    status: 200,
    description: '获取团队成员列表成功',
    type: [TeamMemberDto],
  })
  async getTeamMembers(@Param('teamId') teamId: string) {
    return this.teamService.getTeamMembers(teamId);
  }

  /**
   * MARK: - 所属所有团队
   * NOTE: 获取当前用户所属的所有团队
   * @param req 请求对象，包含当前用户 ID
   * @returns 用户所属团队列表
   */
  @Get()
  @ApiOperation({
    summary: '获取用户所属团队列表',
    description: '获取当前用户作为成员的所有团队列表',
  })
  @ApiResponse({
    status: 200,
    description: '获取用户团队列表成功',
    type: [TeamDto],
  })
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
  @ApiOperation({
    summary: '更新团队成员角色',
    description: '只有团队的OWNER或ADMIN可以更新成员角色',
  })
  @ApiParam({ name: 'teamId', description: '团队ID' })
  @ApiParam({ name: 'memberId', description: '成员用户ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          enum: ['OWNER', 'ADMIN', 'MEMBER'],
          description: '新角色',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '成员角色更新成功',
    type: TeamMemberDto,
  })
  @ApiResponse({
    status: 400,
    description: '无权限更新或不能降级最后一个拥有者',
  })
  @ApiResponse({ status: 404, description: '成员不存在' })
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
  @ApiOperation({
    summary: '移除团队成员',
    description: '只有团队的OWNER或ADMIN可以移除成员，不能移除最后一个拥有者',
  })
  @ApiParam({ name: 'teamId', description: '团队ID' })
  @ApiParam({ name: 'memberId', description: '被移除成员的用户ID' })
  @ApiResponse({
    status: 200,
    description: '成员移除成功',
    type: RemoveMemberResultDto,
  })
  @ApiResponse({
    status: 400,
    description: '无权限移除或不能移除最后一个拥有者',
  })
  @ApiResponse({ status: 404, description: '成员不存在' })
  async removeMember(
    @Param('teamId') teamId: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    const currentUserId = req.user.sub;
    return this.teamService.removeMember(teamId, memberId, currentUserId);
  }

  /**
   * MARK: - 根据用户ID获取团队成员
   * @param userId 用户 ID
   * @returns 团队成员信息
   */
  @Get('by-user-id/:userId')
  @ApiOperation({
    summary: '根据用户ID获取团队成员',
    description: '根据 Supabase 用户ID获取对应的团队成员信息',
  })
  @ApiParam({ name: 'userId', description: 'Supabase 用户ID' })
  @ApiResponse({
    status: 200,
    description: '获取团队成员成功',
    type: TeamMemberDto,
  })
  @ApiResponse({ status: 404, description: '团队成员不存在' })
  async findTeamMemberByUserId(@Param('userId') userId: string) {
    return this.teamService.findTeamMemberByUserId(userId);
  }
}
