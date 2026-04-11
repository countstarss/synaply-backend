import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { DocService } from './doc.service';
import { QueryDocsDto } from './dto/query-docs.dto';
import { CreateDocDto } from './dto/create-doc.dto';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateDocMetaDto } from './dto/update-doc-meta.dto';
import { CreateDocRevisionDto } from './dto/create-doc-revision.dto';

@ApiTags('docs')
@ApiBearerAuth()
@Controller()
@UseGuards(SupabaseAuthGuard)
export class DocController {
  constructor(private readonly docService: DocService) {}

  @Get('workspaces/:workspaceId/docs/tree')
  @ApiOperation({ summary: '获取 Docs 树结构' })
  findTree(
    @Param('workspaceId') workspaceId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryDocsDto,
    @Req() req,
  ) {
    return this.docService.findTree(workspaceId, query, req.user.sub);
  }

  @Get('workspaces/:workspaceId/projects/:projectId/docs')
  @ApiOperation({ summary: '获取项目 Docs 列表' })
  findProjectDocs(
    @Param('workspaceId') workspaceId: string,
    @Param('projectId') projectId: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: QueryDocsDto,
    @Req() req,
  ) {
    return this.docService.findTree(
      workspaceId,
      {
        ...query,
        projectId,
      },
      req.user.sub,
    );
  }

  @Get('workspaces/:workspaceId/docs/:docId')
  @ApiOperation({ summary: '获取文档详情' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Req() req,
  ) {
    return this.docService.findOne(workspaceId, docId, req.user.sub);
  }

  @Get('workspaces/:workspaceId/docs/:docId/revisions')
  @ApiOperation({ summary: '获取文档修订历史' })
  findRevisions(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Req() req,
  ) {
    return this.docService.findRevisions(workspaceId, docId, req.user.sub);
  }

  @Post('workspaces/:workspaceId/docs')
  @ApiOperation({ summary: '创建文档' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateDocDto,
    @Req() req,
  ) {
    return this.docService.create(workspaceId, dto, req.user.sub);
  }

  @Post('workspaces/:workspaceId/docs/folders')
  @ApiOperation({ summary: '创建文件夹' })
  createFolder(
    @Param('workspaceId') workspaceId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateFolderDto,
    @Req() req,
  ) {
    return this.docService.createFolder(workspaceId, dto, req.user.sub);
  }

  @Patch('workspaces/:workspaceId/docs/:docId/meta')
  @ApiOperation({ summary: '更新文档元数据' })
  updateMeta(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: UpdateDocMetaDto,
    @Req() req,
  ) {
    return this.docService.updateMeta(workspaceId, docId, dto, req.user.sub);
  }

  @Post('workspaces/:workspaceId/docs/:docId/revisions')
  @ApiOperation({ summary: '创建文档修订版本' })
  createRevision(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Body(new ValidationPipe({ transform: true, whitelist: true }))
    dto: CreateDocRevisionDto,
    @Req() req,
  ) {
    return this.docService.createRevision(
      workspaceId,
      docId,
      dto,
      req.user.sub,
    );
  }

  @Delete('workspaces/:workspaceId/docs/:docId')
  @ApiOperation({ summary: '删除文档' })
  remove(
    @Param('workspaceId') workspaceId: string,
    @Param('docId') docId: string,
    @Req() req,
  ) {
    return this.docService.remove(workspaceId, docId, req.user.sub);
  }
}
