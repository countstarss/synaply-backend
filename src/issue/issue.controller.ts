import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { IssueService } from './issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { Request } from 'express';

@Controller('workspaces/:workspaceId/issues')
export class IssueController {
  constructor(private readonly issueService: IssueService) {}

  // MARK: 创建任务
  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createIssueDto: CreateIssueDto,
    @Req() req: Request,
  ) {
    // FIXME: 临时处理，后续需要修改 ,后面获取到用户的所有信息之后要挂载到上面req上
    const creatorId =
      req.user?.teamMemberId || 'f17a0b65-be2b-496d-8bc2-72e339403a05'; // Replace with actual logic
    return this.issueService.create(creatorId, {
      ...createIssueDto,
      workspaceId,
    });
  }

  // MARK: 获取任务列表
  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.issueService.findAll(workspaceId, projectId);
  }

  // MARK: 获取任务详情
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issueService.findOne(id);
  }

  // MARK: 更新任务
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIssueDto: UpdateIssueDto) {
    return this.issueService.update(id, updateIssueDto);
  }

  // MARK: 删除任务
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.issueService.remove(id);
  }

  // MARK: 添加评论
  @Post(':issueId/comments')
  addComment(
    @Param('issueId') issueId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const authorId =
      req.user?.teamMemberId || 'f17a0b65-be2b-496d-8bc2-72e339403a05'; // Replace with actual logic
    return this.issueService.addComment(issueId, authorId, createCommentDto);
  }

  // MARK: 添加依赖
  @Post(':issueId/dependencies')
  addDependency(
    @Param('issueId') issueId: string,
    @Body() createIssueDependencyDto: CreateIssueDependencyDto,
  ) {
    return this.issueService.addDependency(issueId, createIssueDependencyDto);
  }

  // MARK: 删除依赖
  @Delete(':issueId/dependencies/:dependsOnIssueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDependency(
    @Param('issueId') issueId: string,
    @Param('dependsOnIssueId') dependsOnIssueId: string,
  ) {
    return this.issueService.removeDependency(issueId, dependsOnIssueId);
  }
}
