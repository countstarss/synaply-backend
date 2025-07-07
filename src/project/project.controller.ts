import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  /**
   * MARK: - 创建项目
   * POST /workspaces/:workspaceId/projects
   * @summary 创建新的项目
   * @description 在指定工作空间下创建新的项目。
   * @param workspaceId 工作空间 ID
   * @param createProjectDto 创建项目的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 创建的项目对象
   */
  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() createProjectDto: CreateProjectDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    // 将 workspaceId 作为单独的参数传递，而不是合并到 DTO 中
    return this.projectService.create(createProjectDto, workspaceId, userId);
  }

  /**
   * MARK: - 获取工作空间下的所有项目
   * GET /workspaces/:workspaceId/projects
   * @summary 获取指定工作空间下的所有项目
   * @description 获取当前用户在指定工作空间下可见的所有项目列表。
   * @param workspaceId 工作空间 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 项目列表
   */
  @Get()
  @ApiOperation({ summary: '获取工作空间下的所有项目' })
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findAll(workspaceId, userId);
  }

  /**
   * MARK: - 获取项目详情
   * GET /workspaces/:workspaceId/projects/:id
   * @summary 获取单个项目的详细信息
   * @description 获取指定 ID 的项目的详细信息。
   * @param id 项目 ID
   * @param req 请求对象，包含当前用户 ID
   * @returns 项目对象
   */
  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const userId = req.user.sub;
    return this.projectService.findOne(id, userId);
  }

  /**
   * MARK: - 更新项目
   * PATCH /workspaces/:workspaceId/projects/:id
   * @summary 更新指定项目
   * @description 更新指定 ID 的项目的各项信息。
   * @param id 项目 ID
   * @param updateProjectDto 更新项目的数据
   * @param req 请求对象，包含当前用户 ID
   * @returns 更新后的项目对象
   */
  @Patch(':id')
  @ApiOperation({ summary: '更新项目' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.update(id, updateProjectDto, userId);
  }

  /**
   * MARK: - 删除项目
   * DELETE /workspaces/:workspaceId/projects/:id
   * @summary 删除指定项目
   * @description 删除指定 ID 的项目。
   * @param id 项目 ID
   * @param req 请求对象，包含当前用户 ID
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const userId = req.user.sub;
    return this.projectService.remove(id, userId);
  }
}
