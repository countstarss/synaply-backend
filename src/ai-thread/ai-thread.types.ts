import {
  AiApprovalStatus,
  AiMessageRole,
  AiPinSource,
  AiRunStatus,
  AiRunStepKind,
  AiSurfaceType,
  AiThreadStatus,
} from '../../prisma/generated/prisma/client';

export {
  AiApprovalStatus,
  AiMessageRole,
  AiPinSource,
  AiRunStatus,
  AiRunStepKind,
  AiSurfaceType,
  AiThreadStatus,
};

/**
 * AI Message 的 parts 是富结构 JSON。下面这些类型描述前后端共享的形状。
 * 实际写库时存的是 JSON，这些类型只是 TS 层校验。
 */

export type AiMessagePart =
  | AiTextPart
  | AiToolCallPart
  | AiToolResultPart
  | AiApprovalRequestPart
  | AiCodingPromptPart
  | AiContextChipPart
  | AiErrorPart;

export interface AiTextPart {
  type: 'text';
  text: string;
}

export interface AiToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface AiToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError?: boolean;
}

export interface AiApprovalRequestPart {
  type: 'approval-request';
  approvalId: string;
  actionKey: string;
  summary: string;
  input: Record<string, unknown>;
  preview?: unknown;
  items?: Array<{
    actionKey: string;
    summary: string;
    input: Record<string, unknown>;
    preview?: unknown;
    status?: 'preview' | 'succeeded' | 'failed' | 'blocked';
    message?: string;
    error?: {
      name?: string;
      message?: string;
      statusCode?: number;
    };
  }>;
}

/**
 * 从对话里直接抛给用户的"可复制给 Claude Code / Codex 的编码 prompt"。
 * 独立于普通 assistant 文本，前端单独渲染。
 */
export interface AiCodingPromptPart {
  type: 'coding-prompt';
  issueId?: string;
  prompt: string;
  generatedAt: string;
}

export interface AiContextChipPart {
  type: 'context-chip';
  surfaceType: AiSurfaceType;
  surfaceId: string;
  label: string;
}

export interface AiErrorPart {
  type: 'error';
  message: string;
  detail?: unknown;
}

export const DEFAULT_AI_MODEL = 'claude-sonnet-4-6';
export const DEFAULT_RUN_MAX_STEPS = 10;
export const DEFAULT_RUN_TOKEN_BUDGET = 60_000;
export const APPROVAL_TTL_HOURS = 24;
