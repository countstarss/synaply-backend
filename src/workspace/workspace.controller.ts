import { Controller, Get, Req, UseGuards, Param } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { WorkspaceDto } from './dto/workspace-response.dto';

@ApiTags('workspaces')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard) // 所有工作空间相关的接口都需要认证
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * MARK: - 获取用户所有工作空间
   * GET /workspaces
   * @summary 获取当前用户的所有工作空间
   * @description 获取当前用户的所有工作空间，包括个人工作空间和所属团队的工作空间
   * @param req 请求对象，包含当前用户 ID
   * @returns 工作空间列表
   */
  @Get()
  @ApiOperation({
    summary: '获取用户所有工作空间',
    description:
      '获取当前用户的所有工作空间，包括个人工作空间和所属团队的工作空间',
  })
  @ApiResponse({
    status: 200,
    description: '获取用户工作空间列表成功',
    type: [WorkspaceDto],
  })
  @ApiResponse({ status: 401, description: '未授权访问' })
  async getUserWorkspaces(@Req() req) {
    const userId = req.user.sub;
    return this.workspaceService.getUserWorkspaces(userId);
  }

  /**
   * MARK: - 根据 ID 获取工作空间详情
   * GET /workspaces/:workspaceId
   * @summary 根据 ID 获取工作空间详情
   * @description 根据工作空间ID获取详细信息，包括关联的用户或团队信息
   * @param workspaceId 工作空间 ID
   * @returns 工作空间对象
   */
  @Get(':workspaceId')
  @ApiOperation({
    summary: '获取工作空间详情',
    description: '根据工作空间ID获取详细信息，包括关联的用户或团队信息',
  })
  @ApiParam({ name: 'workspaceId', description: '工作空间ID' })
  @ApiResponse({
    status: 200,
    description: '获取工作空间详情成功',
    type: WorkspaceDto,
  })
  @ApiResponse({ status: 404, description: '工作空间不存在' })
  @ApiResponse({ status: 401, description: '未授权访问' })
  async getWorkspaceById(@Param('workspaceId') workspaceId: string, @Req() req) {
    return this.workspaceService.getWorkspaceById(workspaceId, req.user.sub);
  }
}
