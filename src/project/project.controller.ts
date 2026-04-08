import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createProjectDto: CreateProjectDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.create(workspaceId, createProjectDto, userId);
  }

  @Get()
  @ApiOperation({ summary: '获取项目列表' })
  findAll(@Param('workspaceId') workspaceId: string, @Req() req) {
    const userId = req.user.sub;
    return this.projectService.findAll(workspaceId, userId);
  }

  @Get(':id/summary')
  @ApiOperation({ summary: '获取项目协作摘要' })
  findSummary(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findSummary(workspaceId, id, userId);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: '获取项目活动流' })
  findActivity(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findActivity(workspaceId, id, userId);
  }

  @Get(':id/workflows')
  @ApiOperation({ summary: '获取项目关联工作流' })
  findWorkflows(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findWorkflows(workspaceId, id, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.findOne(workspaceId, id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新项目' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.update(
      workspaceId,
      id,
      updateProjectDto,
      userId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.projectService.remove(workspaceId, id, userId);
  }
}
