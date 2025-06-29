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
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateIssueDependencyDto } from './dto/create-issue-dependency.dto';
import { Request } from 'express';

@Controller('workspaces/:workspaceId/issues')
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() createIssueDto: CreateIssueDto,
    @Req() req: Request,
  ) {
    // FIXME: 临时处理，后续需要修改 ,后面获取到用户的所有信息之后要挂载到上面req上
    const creatorId =
      req.user?.teamMemberId || 'f17a0b65-be2b-496d-8bc2-72e339403a05'; // Replace with actual logic
    return this.issuesService.create(creatorId, {
      ...createIssueDto,
      workspaceId,
    });
  }

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.issuesService.findAll(workspaceId, projectId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.issuesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateIssueDto: UpdateIssueDto) {
    return this.issuesService.update(id, updateIssueDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.issuesService.remove(id);
  }

  @Post(':issueId/comments')
  addComment(
    @Param('issueId') issueId: string,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: Request,
  ) {
    const authorId =
      req.user?.teamMemberId || 'f17a0b65-be2b-496d-8bc2-72e339403a05'; // Replace with actual logic
    return this.issuesService.addComment(issueId, authorId, createCommentDto);
  }

  @Post(':issueId/dependencies')
  addDependency(
    @Param('issueId') issueId: string,
    @Body() createIssueDependencyDto: CreateIssueDependencyDto,
  ) {
    return this.issuesService.addDependency(issueId, createIssueDependencyDto);
  }

  @Delete(':issueId/dependencies/:dependsOnIssueId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDependency(
    @Param('issueId') issueId: string,
    @Param('dependsOnIssueId') dependsOnIssueId: string,
  ) {
    return this.issuesService.removeDependency(issueId, dependsOnIssueId);
  }
}
