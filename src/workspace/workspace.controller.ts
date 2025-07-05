import { Controller, Get, Req, UseGuards, Param } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';

@UseGuards(SupabaseAuthGuard) // 所有工作空间相关的接口都需要认证
@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  /**
   * 获取当前用户的所有工作空间（包括个人空间和所属团队的空间）
   * @param req 请求对象，包含当前用户 ID
   * @returns 工作空间列表
   */
  // MARK: 获取用户所有工作空间
  @Get()
  async getUserWorkspaces(@Req() req) {
    const userId = req.user.sub;
    return this.workspaceService.getUserWorkspaces(userId);
  }

  /**
   * 根据 ID 获取工作空间详情
   * @param workspaceId 工作空间 ID
   * @returns 工作空间对象
   */
  // MARK: 根据ID获取空间详情
  @Get(':workspaceId')
  async getWorkspaceById(@Param('workspaceId') workspaceId: string) {
    return this.workspaceService.getWorkspaceById(workspaceId);
  }
}
