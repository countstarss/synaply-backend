import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { AppendMessageDto } from './dto/append-message.dto';
import { StartRunDto } from './dto/start-run.dto';
import { FinishRunDto } from './dto/finish-run.dto';
import { RecordStepDto } from './dto/record-step.dto';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { PinContextDto } from './dto/pin-context.dto';
import {
  APPROVAL_TTL_HOURS,
  DEFAULT_AI_MODEL,
  DEFAULT_RUN_MAX_STEPS,
  DEFAULT_RUN_TOKEN_BUDGET,
} from './ai-thread.types';
import {
  AiApprovalStatus,
  AiPinSource,
  AiRunStatus,
  AiThreadStatus,
} from '../../prisma/generated/prisma/client';

/**
 * AI Thread persistence layer.
 *
 * 这个 service 不调模型、不跑 tool loop。它只负责把 Next.js runtime 跑出的
 * thread / message / run / step / approval 写进数据库，并提供读取接口。
 *
 * 所有方法都通过 TeamMemberService.validateWorkspaceAccess 做工作空间隔离，
 * 与 inbox / ai-execution 同口径（不依赖 Postgres RLS）。
 */
@Injectable()
export class AiThreadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
  ) {}

  // ----- Threads -----

  async createThread(
    workspaceId: string,
    userId: string,
    dto: CreateThreadDto,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    if (
      (dto.originSurfaceType && !dto.originSurfaceId) ||
      (!dto.originSurfaceType && dto.originSurfaceId)
    ) {
      throw new BadRequestException(
        'originSurfaceType 和 originSurfaceId 必须同时提供',
      );
    }

    const thread = await this.prisma.aiThread.create({
      data: {
        workspaceId,
        creatorUserId: userId,
        title: dto.title ?? null,
        originSurfaceType: dto.originSurfaceType ?? null,
        originSurfaceId: dto.originSurfaceId ?? null,
      },
    });

    if (dto.originSurfaceType && dto.originSurfaceId) {
      await this.prisma.aiThreadContextPin.create({
        data: {
          threadId: thread.id,
          surfaceType: dto.originSurfaceType,
          surfaceId: dto.originSurfaceId,
          source: AiPinSource.ORIGIN,
          pinnedByUserId: userId,
        },
      });
    }

    return this.serializeThread(thread, []);
  }

  async listThreads(workspaceId: string, userId: string, limit = 30) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const threads = await this.prisma.aiThread.findMany({
      where: {
        workspaceId,
        creatorUserId: userId,
        status: AiThreadStatus.ACTIVE,
      },
      orderBy: { lastMessageAt: 'desc' },
      take: limit,
      include: { pins: true },
    });

    return threads.map((thread) => this.serializeThread(thread, thread.pins));
  }

  async getThread(workspaceId: string, userId: string, threadId: string) {
    const thread = await this.loadThreadOrThrow(
      workspaceId,
      userId,
      threadId,
      true,
    );
    return this.serializeThread(thread, thread.pins);
  }

  async getThreadMessages(
    workspaceId: string,
    userId: string,
    threadId: string,
    limit = 200,
    cursor?: string,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId);

    const parsedLimit = Math.min(Math.max(limit, 1), 200);
    let cursorFilter:
      | {
          OR: Array<
            | { createdAt: { gt: Date } }
            | {
                AND: [{ createdAt: Date }, { id: { gt: string } }];
              }
          >;
        }
      | undefined;

    if (cursor) {
      const cursorMessage = await this.prisma.aiMessage.findUnique({
        where: { id: cursor },
      });

      if (!cursorMessage || cursorMessage.threadId !== threadId) {
        throw new BadRequestException('消息游标无效');
      }

      cursorFilter = {
        OR: [
          { createdAt: { gt: cursorMessage.createdAt } },
          {
            AND: [
              { createdAt: cursorMessage.createdAt },
              { id: { gt: cursorMessage.id } },
            ],
          },
        ],
      };
    }

    const messages = await this.prisma.aiMessage.findMany({
      where: {
        threadId,
        ...(cursorFilter ?? {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: parsedLimit + 1,
    });

    const hasMore = messages.length > parsedLimit;
    const items = (hasMore ? messages.slice(0, parsedLimit) : messages).map(
      (message) => this.serializeMessage(message),
    );
    const nextCursor = hasMore ? (items.at(-1)?.id ?? null) : null;

    return {
      items,
      nextCursor,
    };
  }

  // ----- Messages -----

  async appendMessage(
    workspaceId: string,
    userId: string,
    threadId: string,
    dto: AppendMessageDto,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId);

    const message = await this.prisma.aiMessage.create({
      data: {
        threadId,
        runId: dto.runId ?? null,
        role: dto.role,
        parts: dto.parts as any,
      },
    });

    await this.prisma.aiThread.update({
      where: { id: threadId },
      data: { lastMessageAt: message.createdAt },
    });

    return this.serializeMessage(message);
  }

  // ----- Runs -----

  async startRun(
    workspaceId: string,
    userId: string,
    threadId: string,
    dto: StartRunDto,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId);

    const run = await this.prisma.aiRun.create({
      data: {
        threadId,
        model: dto.model || DEFAULT_AI_MODEL,
        maxSteps: dto.maxSteps ?? DEFAULT_RUN_MAX_STEPS,
        tokenBudget: dto.tokenBudget ?? DEFAULT_RUN_TOKEN_BUDGET,
      },
    });

    return this.serializeRun(run);
  }

  async recordRunStep(
    workspaceId: string,
    userId: string,
    threadId: string,
    runId: string,
    dto: RecordStepDto,
  ) {
    const run = await this.loadRunOrThrow(workspaceId, userId, threadId, runId);

    const step = await this.prisma.aiRunStep.create({
      data: {
        runId: run.id,
        stepIndex: dto.stepIndex,
        kind: dto.kind,
        model: dto.model ?? null,
        toolName: dto.toolName ?? null,
        toolInput: (dto.toolInput as any) ?? null,
        toolOutput: (dto.toolOutput as any) ?? null,
        promptSnapshot: this.truncateJsonSnapshot(dto.promptSnapshot) as any,
        responseSnapshot: this.truncateJsonSnapshot(
          dto.responseSnapshot,
        ) as any,
        tokensIn: dto.tokensIn ?? null,
        tokensOut: dto.tokensOut ?? null,
        latencyMs: dto.latencyMs ?? null,
        error: (dto.error as any) ?? null,
      },
    });

    const stepIncrement = (dto.tokensIn ?? 0) + (dto.tokensOut ?? 0);
    if (stepIncrement > 0) {
      await this.prisma.aiRun.update({
        where: { id: run.id },
        data: {
          stepCount: { increment: 1 },
          tokensUsed: { increment: stepIncrement },
        },
      });
    } else {
      await this.prisma.aiRun.update({
        where: { id: run.id },
        data: { stepCount: { increment: 1 } },
      });
    }

    return {
      id: step.id,
      runId: step.runId,
      stepIndex: step.stepIndex,
      kind: step.kind,
      createdAt: step.createdAt.toISOString(),
    };
  }

  async finishRun(
    workspaceId: string,
    userId: string,
    threadId: string,
    runId: string,
    dto: FinishRunDto,
  ) {
    await this.loadRunOrThrow(workspaceId, userId, threadId, runId);

    const run = await this.prisma.aiRun.update({
      where: { id: runId },
      data: {
        status: dto.status,
        finishedAt: new Date(),
        tokensUsed: dto.tokensUsed ?? undefined,
        lastError: (dto.lastError as any) ?? null,
      },
    });

    return this.serializeRun(run);
  }

  // ----- Approvals -----

  async createApproval(
    workspaceId: string,
    userId: string,
    threadId: string,
    dto: CreateApprovalDto,
  ) {
    const run = await this.loadRunOrThrow(
      workspaceId,
      userId,
      threadId,
      dto.runId,
    );

    const expiresAt = new Date(
      Date.now() + APPROVAL_TTL_HOURS * 60 * 60 * 1000,
    );

    const approval = await this.prisma.aiPendingApproval.create({
      data: {
        threadId,
        runId: run.id,
        actionKey: dto.actionKey,
        summary: dto.summary ?? null,
        input: (dto.input as any) ?? null,
        previewResult: (dto.previewResult as any) ?? null,
        expiresAt,
      },
    });

    await this.prisma.aiRun.update({
      where: { id: run.id },
      data: {
        status: AiRunStatus.WAITING_APPROVAL,
        pendingApprovalId: approval.id,
      },
    });

    return this.serializeApproval(approval);
  }

  async confirmApproval(
    workspaceId: string,
    userId: string,
    threadId: string,
    approvalId: string,
  ) {
    return this.resolveApproval(
      workspaceId,
      userId,
      threadId,
      approvalId,
      AiApprovalStatus.CONFIRMED,
    );
  }

  async rejectApproval(
    workspaceId: string,
    userId: string,
    threadId: string,
    approvalId: string,
  ) {
    return this.resolveApproval(
      workspaceId,
      userId,
      threadId,
      approvalId,
      AiApprovalStatus.REJECTED,
    );
  }

  /**
   * 把 expired 的 pending approval 收尾。Cron 调用。
   */
  async sweepExpiredApprovals(now: Date = new Date()) {
    const expired = await this.prisma.aiPendingApproval.findMany({
      where: {
        status: AiApprovalStatus.PENDING,
        expiresAt: { lt: now },
      },
      take: 200,
    });

    for (const approval of expired) {
      await this.prisma.aiPendingApproval.update({
        where: { id: approval.id },
        data: {
          status: AiApprovalStatus.EXPIRED,
          resolvedAt: now,
        },
      });

      await this.prisma.aiRun.update({
        where: { id: approval.runId },
        data: {
          status: AiRunStatus.CANCELLED,
          finishedAt: now,
        },
      });

      await this.prisma.aiMessage.create({
        data: {
          threadId: approval.threadId,
          runId: approval.runId,
          role: 'SYSTEM',
          parts: [
            {
              type: 'error',
              message: `pending approval ${approval.id} 已超时，run 自动取消。`,
            },
          ] as any,
        },
      });
    }

    return expired.length;
  }

  // ----- Context Pins -----

  async pinContext(
    workspaceId: string,
    userId: string,
    threadId: string,
    dto: PinContextDto,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId);

    const pin = await this.prisma.aiThreadContextPin.upsert({
      where: {
        threadId_surfaceType_surfaceId: {
          threadId,
          surfaceType: dto.surfaceType,
          surfaceId: dto.surfaceId,
        },
      },
      update: {
        source: dto.source ?? AiPinSource.USER,
        pinnedByUserId: userId,
        pinnedAt: new Date(),
      },
      create: {
        threadId,
        surfaceType: dto.surfaceType,
        surfaceId: dto.surfaceId,
        source: dto.source ?? AiPinSource.USER,
        pinnedByUserId: userId,
      },
    });

    return this.serializePin(pin);
  }

  async unpinContext(
    workspaceId: string,
    userId: string,
    threadId: string,
    pinId: string,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId);

    const pin = await this.prisma.aiThreadContextPin.findUnique({
      where: { id: pinId },
    });

    if (!pin || pin.threadId !== threadId) {
      throw new NotFoundException('pin 不存在');
    }

    await this.prisma.aiThreadContextPin.delete({ where: { id: pinId } });
    return { id: pinId, deleted: true };
  }

  // ----- Internals -----

  private async loadThreadOrThrow(
    workspaceId: string,
    userId: string,
    threadId: string,
    includePins = true,
  ) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const thread = await this.prisma.aiThread.findUnique({
      where: { id: threadId },
      include: includePins ? { pins: true } : undefined,
    });

    if (!thread || thread.workspaceId !== workspaceId) {
      throw new NotFoundException('AI thread 不存在');
    }

    if (thread.creatorUserId !== userId) {
      throw new ForbiddenException('无权访问该 AI thread');
    }

    return thread as typeof thread & {
      pins: {
        id: string;
        threadId: string;
        surfaceType: any;
        surfaceId: string;
        source: any;
        pinnedByUserId: string | null;
        pinnedAt: Date;
      }[];
    };
  }

  private async loadRunOrThrow(
    workspaceId: string,
    userId: string,
    threadId: string,
    runId: string,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId, false);

    const run = await this.prisma.aiRun.findUnique({ where: { id: runId } });
    if (!run || run.threadId !== threadId) {
      throw new NotFoundException('AI run 不存在');
    }
    return run;
  }

  private async resolveApproval(
    workspaceId: string,
    userId: string,
    threadId: string,
    approvalId: string,
    nextStatus: AiApprovalStatus,
  ) {
    await this.loadThreadOrThrow(workspaceId, userId, threadId, false);

    const approval = await this.prisma.aiPendingApproval.findUnique({
      where: { id: approvalId },
    });

    if (!approval || approval.threadId !== threadId) {
      throw new NotFoundException('待审批动作不存在');
    }

    if (approval.status !== AiApprovalStatus.PENDING) {
      throw new BadRequestException(
        `审批已处于 ${approval.status} 状态，无法再次修改`,
      );
    }

    const updated = await this.prisma.aiPendingApproval.update({
      where: { id: approvalId },
      data: {
        status: nextStatus,
        resolvedAt: new Date(),
        resolvedByUserId: userId,
      },
    });

    if (nextStatus === AiApprovalStatus.REJECTED) {
      await this.prisma.aiRun.update({
        where: { id: approval.runId },
        data: {
          status: AiRunStatus.CANCELLED,
          finishedAt: new Date(),
        },
      });
    }

    return this.serializeApproval(updated);
  }

  private serializeThread(thread: any, pins: any[]) {
    return {
      id: thread.id,
      workspaceId: thread.workspaceId,
      creatorUserId: thread.creatorUserId,
      title: thread.title,
      status: thread.status,
      originSurfaceType: thread.originSurfaceType,
      originSurfaceId: thread.originSurfaceId,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      lastMessageAt: thread.lastMessageAt
        ? thread.lastMessageAt.toISOString()
        : null,
      pins: pins.map((pin) => this.serializePin(pin)),
    };
  }

  private serializeRun(run: any) {
    return {
      id: run.id,
      threadId: run.threadId,
      status: run.status,
      model: run.model,
      stepCount: run.stepCount,
      maxSteps: run.maxSteps,
      tokenBudget: run.tokenBudget,
      tokensUsed: run.tokensUsed,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
      lastError: run.lastError ?? null,
      pendingApprovalId: run.pendingApprovalId,
    };
  }

  private serializeMessage(message: any) {
    return {
      id: message.id,
      threadId: message.threadId,
      runId: message.runId,
      role: message.role,
      parts: message.parts,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private serializeApproval(approval: any) {
    return {
      id: approval.id,
      threadId: approval.threadId,
      runId: approval.runId,
      actionKey: approval.actionKey,
      summary: approval.summary,
      input: approval.input,
      previewResult: approval.previewResult,
      status: approval.status,
      createdAt: approval.createdAt.toISOString(),
      resolvedAt: approval.resolvedAt
        ? approval.resolvedAt.toISOString()
        : null,
      resolvedByUserId: approval.resolvedByUserId,
      expiresAt: approval.expiresAt.toISOString(),
    };
  }

  private serializePin(pin: any) {
    return {
      id: pin.id,
      threadId: pin.threadId,
      surfaceType: pin.surfaceType,
      surfaceId: pin.surfaceId,
      source: pin.source,
      pinnedByUserId: pin.pinnedByUserId,
      pinnedAt: pin.pinnedAt.toISOString(),
    };
  }

  private truncateJsonSnapshot(value: unknown, maxLength = 8 * 1024): unknown {
    if (value == null) {
      return null;
    }

    const serialized = this.safeJsonStringify(value);
    if (!serialized) {
      return null;
    }

    if (serialized.length <= maxLength) {
      return value;
    }

    if (typeof value === 'string') {
      return `${value.slice(0, Math.max(maxLength - 16, 0))}...(truncated)`;
    }

    return {
      truncated: true,
      preview: `${serialized.slice(0, Math.max(maxLength - 16, 0))}...(truncated)`,
      originalLength: serialized.length,
    };
  }

  private safeJsonStringify(value: unknown) {
    try {
      return typeof value === 'string' ? value : JSON.stringify(value);
    } catch {
      return null;
    }
  }
}
