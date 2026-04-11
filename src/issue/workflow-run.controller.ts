import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { IssueService } from './issue.service';
import { UpdateWorkflowRunStatusDto } from './dto/update-workflow-run-status.dto';
import { AdvanceWorkflowRunDto } from './dto/advance-workflow-run.dto';
import { RevertWorkflowRunDto } from './dto/revert-workflow-run.dto';
import { BlockWorkflowRunDto } from './dto/block-workflow-run.dto';
import { UnblockWorkflowRunDto } from './dto/unblock-workflow-run.dto';
import { RequestWorkflowReviewDto } from './dto/request-workflow-review.dto';
import { RequestWorkflowHandoffDto } from './dto/request-workflow-handoff.dto';
import { SubmitWorkflowRecordDto } from './dto/submit-workflow-record.dto';
import { RespondWorkflowReviewDto } from './dto/respond-workflow-review.dto';
import { AcceptWorkflowHandoffDto } from './dto/accept-workflow-handoff.dto';

@ApiTags('workflow-runs')
@ApiBearerAuth()
@Controller('workspaces/:workspaceId/workflow-runs')
@UseGuards(SupabaseAuthGuard)
export class WorkflowRunController {
  constructor(private readonly issueService: IssueService) {}

  @Get(':id')
  @ApiOperation({ summary: '获取 workflow run 详情' })
  findOne(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.getWorkflowRun(userId, workspaceId, id);
  }

  @Post(':id/status')
  @ApiOperation({ summary: '更新 workflow run 当前步骤状态' })
  updateStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowRunStatusDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.updateWorkflowRunStatus(
      userId,
      workspaceId,
      id,
      dto,
    );
  }

  @Post(':id/advance')
  @ApiOperation({ summary: '推进 workflow run 到下一步' })
  advance(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AdvanceWorkflowRunDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.advanceWorkflowRun(userId, workspaceId, id, dto);
  }

  @Post(':id/revert')
  @ApiOperation({ summary: '回退 workflow run 到上一步' })
  revert(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: RevertWorkflowRunDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.revertWorkflowRun(userId, workspaceId, id, dto);
  }

  @Post(':id/block')
  @ApiOperation({ summary: '阻塞 workflow run 当前步骤' })
  block(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: BlockWorkflowRunDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.blockWorkflowRun(userId, workspaceId, id, dto);
  }

  @Post(':id/unblock')
  @ApiOperation({ summary: '解除 workflow run 当前步骤阻塞' })
  unblock(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UnblockWorkflowRunDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.unblockWorkflowRun(userId, workspaceId, id, dto);
  }

  @Post(':id/request-review')
  @ApiOperation({ summary: '为 workflow run 当前步骤请求 review' })
  requestReview(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: RequestWorkflowReviewDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.requestWorkflowReview(
      userId,
      workspaceId,
      id,
      dto,
    );
  }

  @Post(':id/respond-review')
  @ApiOperation({ summary: '响应 workflow run 当前步骤的 review 请求' })
  respondReview(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: RespondWorkflowReviewDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.respondWorkflowReview(
      userId,
      workspaceId,
      id,
      dto,
    );
  }

  @Post(':id/request-handoff')
  @ApiOperation({ summary: '为 workflow run 当前步骤请求 handoff' })
  requestHandoff(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: RequestWorkflowHandoffDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.requestWorkflowHandoff(
      userId,
      workspaceId,
      id,
      dto,
    );
  }

  @Post(':id/accept-handoff')
  @ApiOperation({ summary: '接受 workflow run 当前步骤的 handoff 请求' })
  acceptHandoff(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: AcceptWorkflowHandoffDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.acceptWorkflowHandoff(
      userId,
      workspaceId,
      id,
      dto,
    );
  }

  @Post(':id/submit-record')
  @ApiOperation({ summary: '提交 workflow run 当前步骤成果记录' })
  submitRecord(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: SubmitWorkflowRecordDto,
    @Req() req: Request,
  ) {
    const userId = req.user?.sub;
    return this.issueService.submitWorkflowRecord(userId, workspaceId, id, dto);
  }
}
