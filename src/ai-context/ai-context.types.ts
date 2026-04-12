import { AiSurfaceType } from '../../prisma/generated/prisma/client';

export { AiSurfaceType };

/**
 * 浓缩 surface 摘要：每个 pinned 对象 ≤ 500 tokens 的简短描述。
 *
 * Next.js runtime 每次调用模型前都会自动注入这个，让模型不调用任何工具就能
 * 知道"在讨论的是哪些对象"。深度信息靠 read tools 按需拉取。
 */
export interface AiSurfaceSummary {
  surfaceType: AiSurfaceType;
  surfaceId: string;
  title: string;
  status?: string;
  ownerLabel?: string;
  recentActivity?: string;
  /**
   * 最终塞给模型的纯文本 chunk（已经按 500 tokens 上限截断）。
   */
  text: string;
}

export interface AiWorkspaceSummaryDetail {
  workspace: {
    id: string;
    name: string;
    type: string;
  };
  counts: {
    projectCount: number;
    issueCount: number;
    openIssueCount: number;
    docCount: number;
  };
  recentProjects: Array<{
    id: string;
    name: string;
    status: string;
    phase?: string | null;
    riskLevel?: string | null;
  }>;
  recentIssues: Array<{
    id: string;
    key?: string | null;
    title: string;
    state?: string | null;
    projectName?: string | null;
  }>;
  recentDocs: Array<{
    id: string;
    title: string;
    type: string;
    updatedAt: string;
  }>;
  text: string;
}

export interface AiActorContextDetail {
  actor: {
    userId: string;
    name?: string | null;
    email?: string | null;
    teamMemberId: string;
    role: string;
  };
  workspace: {
    id: string;
    name: string;
    type: string;
  };
  text: string;
}

export interface AiProjectSearchResult {
  items: Array<{
    id: string;
    name: string;
    brief?: string | null;
    status?: string | null;
    phase?: string | null;
    riskLevel?: string | null;
    updatedAt: string;
  }>;
  text: string;
}

export interface AiIssueSearchResult {
  items: Array<{
    id: string;
    key?: string | null;
    title: string;
    description?: string | null;
    state?: string | null;
    projectId?: string | null;
    projectName?: string | null;
    updatedAt: string;
    assigneeLabels: string[];
    currentStepStatus?: string | null;
  }>;
  text: string;
}

export interface AiProjectDetail {
  project: Record<string, unknown>;
  summary: Record<string, unknown>;
  text: string;
}

export interface AiIssueDetail {
  issue: Record<string, unknown>;
  linkedDocs: Array<Record<string, unknown>>;
  recentComments: Array<Record<string, unknown>>;
  text: string;
}

export interface AiWorkflowRunDetail {
  workflowRun: Record<string, unknown>;
  stepRecords: Array<Record<string, unknown>>;
  recentActivities: Array<Record<string, unknown>>;
  linkedDocs: Array<Record<string, unknown>>;
  text: string;
}

export interface AiDocDetail {
  doc: Record<string, unknown>;
  recentRevisions: Array<Record<string, unknown>>;
  text: string;
}

export interface AiDocSearchResult {
  items: Array<Record<string, unknown>>;
  text: string;
}

export interface AiWorkspaceMemberSearchResult {
  items: Array<{
    teamMemberId: string;
    userId: string;
    name?: string | null;
    email?: string | null;
    role: string;
    isCurrentActor: boolean;
  }>;
  text: string;
}

export interface AiIssueListResult {
  filters: {
    projectId?: string | null;
    assigneeScope: 'ANY' | 'ME';
    stateCategories: string[];
    limit: number;
  };
  items: Array<{
    id: string;
    key?: string | null;
    title: string;
    state?: string | null;
    stateCategory?: string | null;
    projectName?: string | null;
    updatedAt: string;
    assigneeLabels: string[];
    currentStepStatus?: string | null;
  }>;
  text: string;
}

export interface AiCodingPromptAssembly {
  issueId: string;
  prompt: string;
  linkedDocIds: string[];
  text: string;
}
