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

  // MARK: 创建项目
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

  // MARK: 获取工作空间下的所有项目
  @Get()
  @ApiOperation({ summary: '获取工作空间下的所有项目' })
  findAll(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findAll(workspaceId, userId);
  }

  // MARK: 获取项目详情
  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const userId = req.user.sub;
    return this.projectService.findOne(id, userId);
  }

  // MARK: 更新项目
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

  // MARK: 删除项目
  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req) {
    const userId = req.user.sub;
    return this.projectService.remove(id, userId);
  }
}
