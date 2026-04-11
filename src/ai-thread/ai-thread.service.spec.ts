import { BadRequestException } from '@nestjs/common';
import {
  AiApprovalStatus,
  AiPinSource,
} from '../../prisma/generated/prisma/client';
import { AiThreadService } from './ai-thread.service';

const createPrismaMock = () => ({
  aiThread: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  aiThreadContextPin: {
    create: jest.fn(),
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
  aiMessage: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  aiRun: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  aiRunStep: {
    create: jest.fn(),
  },
  aiPendingApproval: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
});

const createService = () => {
  const prisma = createPrismaMock();
  const teamMemberService = {
    validateWorkspaceAccess: jest.fn().mockResolvedValue({
      workspace: { id: 'workspace-1' },
      teamMemberId: 'member-1',
    }),
  };

  const service = new AiThreadService(prisma as any, teamMemberService as any);

  return { prisma, service, teamMemberService };
};

describe('AiThreadService', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  it('creates an origin pin when the thread is created from a surface', async () => {
    const { prisma, service, teamMemberService } = createService();
    const createdAt = new Date('2026-04-11T10:00:00.000Z');

    prisma.aiThread.create.mockResolvedValue({
      id: 'thread-1',
      workspaceId: 'workspace-1',
      creatorUserId: 'user-1',
      title: 'AI 协作线程',
      status: 'ACTIVE',
      originSurfaceType: 'ISSUE',
      originSurfaceId: 'issue-1',
      createdAt,
      updatedAt: createdAt,
      lastMessageAt: null,
    });

    const result = await service.createThread('workspace-1', 'user-1', {
      title: 'AI 协作线程',
      originSurfaceType: 'ISSUE' as any,
      originSurfaceId: 'issue-1',
    });

    expect(teamMemberService.validateWorkspaceAccess).toHaveBeenCalledWith(
      'user-1',
      'workspace-1',
    );
    expect(prisma.aiThreadContextPin.create).toHaveBeenCalledWith({
      data: {
        threadId: 'thread-1',
        surfaceType: 'ISSUE',
        surfaceId: 'issue-1',
        source: AiPinSource.ORIGIN,
        pinnedByUserId: 'user-1',
      },
    });
    expect(result.pins).toEqual([]);
  });

  it('creates approvals that expire roughly 24 hours later', async () => {
    const { prisma, service } = createService();
    const frozenNow = new Date('2026-04-11T10:00:00.000Z');
    jest.useFakeTimers().setSystemTime(frozenNow);

    prisma.aiThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      workspaceId: 'workspace-1',
      creatorUserId: 'user-1',
    });
    prisma.aiRun.findUnique.mockResolvedValue({
      id: 'run-1',
      threadId: 'thread-1',
    });
    prisma.aiPendingApproval.create.mockImplementation(async ({ data }) => ({
      id: 'approval-1',
      threadId: data.threadId,
      runId: data.runId,
      actionKey: data.actionKey,
      summary: data.summary,
      input: data.input,
      previewResult: data.previewResult,
      status: 'PENDING',
      createdAt: frozenNow,
      resolvedAt: null,
      resolvedByUserId: null,
      expiresAt: data.expiresAt,
    }));
    prisma.aiRun.update.mockResolvedValue(undefined);

    const result = await service.createApproval(
      'workspace-1',
      'user-1',
      'thread-1',
      {
        runId: 'run-1',
        actionKey: 'issue.create',
        summary: '创建一条任务',
        input: { title: '补完 AI runtime' },
        previewResult: { ok: true },
      },
    );

    const expiresAt = new Date(result.expiresAt).getTime();
    expect(expiresAt).toBe(frozenNow.getTime() + 24 * 60 * 60 * 1000);
  });

  it('rejects confirming an approval that has already been resolved', async () => {
    const { prisma, service } = createService();

    prisma.aiThread.findUnique.mockResolvedValue({
      id: 'thread-1',
      workspaceId: 'workspace-1',
      creatorUserId: 'user-1',
    });
    prisma.aiPendingApproval.findUnique.mockResolvedValue({
      id: 'approval-1',
      threadId: 'thread-1',
      runId: 'run-1',
      status: AiApprovalStatus.CONFIRMED,
    });

    await expect(
      service.confirmApproval(
        'workspace-1',
        'user-1',
        'thread-1',
        'approval-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.aiPendingApproval.update).not.toHaveBeenCalled();
  });
});
