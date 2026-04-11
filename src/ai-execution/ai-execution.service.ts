import { randomUUID } from 'crypto';
import {
  IssuePriority,
  IssueStatus,
  Prisma,
  Role,
  VisibilityType,
} from '../../prisma/generated/prisma/client';
import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { ValidationError, validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { TeamMemberService } from '../common/services/team-member.service';
import { ProjectService } from '../project/project.service';
import { IssueService } from '../issue/issue.service';
import { DocService } from '../doc/doc.service';
import { WorkflowService } from '../workflow/workflow.service';
import { CommentService } from '../comment/comment.service';
import { CreateProjectDto } from '../project/dto/create-project.dto';
import { UpdateProjectDto } from '../project/dto/update-project.dto';
import { CreateIssueDto } from '../issue/dto/create-issue.dto';
import { UpdateIssueDto } from '../issue/dto/update-issue.dto';
import { CreateDocDto } from '../doc/dto/create-doc.dto';
import { CreateDocRevisionDto } from '../doc/dto/create-doc-revision.dto';
import { UpdateDocMetaDto } from '../doc/dto/update-doc-meta.dto';
import { DocChangeSourceValue } from '../doc/doc.constants';
import { CreateWorkflowDto } from '../workflow/dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../workflow/dto/update-workflow.dto';
import { CreateWorkflowIssueDto } from '../issue/dto/create-workflow-issue.dto';
import { UpdateWorkflowRunStatusDto } from '../issue/dto/update-workflow-run-status.dto';
import { AdvanceWorkflowRunDto } from '../issue/dto/advance-workflow-run.dto';
import { RevertWorkflowRunDto } from '../issue/dto/revert-workflow-run.dto';
import { BlockWorkflowRunDto } from '../issue/dto/block-workflow-run.dto';
import { UnblockWorkflowRunDto } from '../issue/dto/unblock-workflow-run.dto';
import { RequestWorkflowReviewDto } from '../issue/dto/request-workflow-review.dto';
import {
  RespondWorkflowReviewDto,
  WorkflowReviewOutcome,
} from '../issue/dto/respond-workflow-review.dto';
import { RequestWorkflowHandoffDto } from '../issue/dto/request-workflow-handoff.dto';
import { AcceptWorkflowHandoffDto } from '../issue/dto/accept-workflow-handoff.dto';
import { SubmitWorkflowRecordDto } from '../issue/dto/submit-workflow-record.dto';
import { CreateCommentDto } from '../comment/dto';
import {
  ProjectRiskLevelValue,
  ProjectStatusValue,
} from '../project/project.constants';
import {
  AiActionActorContext,
  AiActionAvailability,
  AiActionDefinition,
  AiActionKey,
  AiApprovalMode,
  AiExecutionStatus,
  AiExecutionTargetType,
} from './ai-execution.types';

function readString(
  input: Record<string, unknown>,
  key: string,
): string | null {
  const value = input[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) =>
      typeof currentValue === 'bigint'
        ? Number(currentValue)
        : currentValue instanceof Date
          ? currentValue.toISOString()
          : currentValue,
    ),
  ) as T;
}

function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => {
    const currentErrors = error.constraints
      ? Object.values(error.constraints).map(
          (message) => `${error.property}: ${message}`,
        )
      : [];
    const childErrors =
      error.children && error.children.length > 0
        ? formatValidationErrors(error.children)
        : [];

    return [...currentErrors, ...childErrors];
  });
}

const VISIBILITY_OPTIONS = Object.values(VisibilityType);
const ISSUE_PRIORITY_OPTIONS = Object.values(IssuePriority);
const ISSUE_STATUS_OPTIONS = Object.values(IssueStatus);
const PROJECT_STATUS_OPTIONS = Object.values(ProjectStatusValue);
const PROJECT_RISK_OPTIONS = Object.values(ProjectRiskLevelValue);
const WORKFLOW_REVIEW_OUTCOME_OPTIONS = Object.values(WorkflowReviewOutcome);
const DOC_CHANGE_SOURCE_OPTIONS = Object.values(DocChangeSourceValue);
const ENUM_ALIAS_MAP: Record<string, string> = {
  PERSONAL: 'PRIVATE',
  SELF: 'PRIVATE',
  '仅自己': 'PRIVATE',
  私有: 'PRIVATE',
  TEAM: 'TEAM_READONLY',
  TEAM_READ_ONLY: 'TEAM_READONLY',
  READONLY: 'TEAM_READONLY',
  '团队': 'TEAM_READONLY',
  '团队可见': 'TEAM_READONLY',
  '团队只读': 'TEAM_READONLY',
  TEAM_EDIT: 'TEAM_EDITABLE',
  EDITABLE: 'TEAM_EDITABLE',
  '团队可编辑': 'TEAM_EDITABLE',
  公开: 'PUBLIC',
  ALMOST_DONE: 'AMOST_DONE',
  APPROVE: 'APPROVED',
  PASS: 'APPROVED',
  PASSED: 'APPROVED',
  REQUEST_CHANGES: 'CHANGES_REQUESTED',
  NEEDS_CHANGES: 'CHANGES_REQUESTED',
  CHANGES_REQUIRED: 'CHANGES_REQUESTED',
  REJECT: 'CHANGES_REQUESTED',
  REJECTED: 'CHANGES_REQUESTED',
};

function normalizeEnumToken(value: string) {
  return value.trim().replace(/[\s-]+/g, '_').toUpperCase();
}

const ACTION_DEFINITIONS: AiActionDefinition[] = [
  {
    key: 'create_project',
    label: '创建项目',
    description: '根据结构化输入在当前工作空间创建 Project。',
    area: 'project',
    targetType: 'WORKSPACE',
    approvalMode: 'CONFIRM',
    requiresTargetId: false,
    minimumTeamRole: 'ADMIN',
    fields: [
      {
        name: 'name',
        label: '项目名称',
        type: 'string',
        required: true,
        description: '项目标题。',
      },
      {
        name: 'brief',
        label: '项目 brief',
        type: 'string',
        required: false,
        description: '项目一句话结果定义。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '项目上下文说明。',
      },
      {
        name: 'phase',
        label: '阶段',
        type: 'string',
        required: false,
        description: '当前阶段或里程碑。',
      },
      {
        name: 'status',
        label: '状态',
        type: 'enum',
        required: false,
        description: '项目协作状态。',
        options: PROJECT_STATUS_OPTIONS,
      },
      {
        name: 'riskLevel',
        label: '风险级别',
        type: 'enum',
        required: false,
        description: '项目当前风险级别。',
        options: PROJECT_RISK_OPTIONS,
      },
      {
        name: 'ownerMemberId',
        label: '负责人',
        type: 'string',
        required: false,
        description: '负责人 TeamMember ID。',
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: '项目可见性策略。',
        options: VISIBILITY_OPTIONS,
      },
    ],
    sampleInput: {
      name: 'AI 执行层建设',
      brief: '让 AI 在可控权限下驱动真实协作对象。',
      description: '补齐 action contract、确认机制与审计记录。',
      phase: 'Architecture',
      status: ProjectStatusValue.ACTIVE,
      riskLevel: ProjectRiskLevelValue.MEDIUM,
    },
    buildSummary: (input) =>
      `将在当前工作空间创建项目「${readString(input, 'name') ?? '未命名项目'}」。`,
    getTargetId: () => null,
  },
  {
    key: 'update_project',
    label: '更新项目',
    description: '更新项目的 brief、负责人、阶段和可见性等核心字段。',
    area: 'project',
    targetType: 'PROJECT',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'ADMIN',
    fields: [
      {
        name: 'projectId',
        label: '项目 ID',
        type: 'string',
        required: true,
        description: '要更新的 Project ID。',
      },
      {
        name: 'name',
        label: '项目名称',
        type: 'string',
        required: false,
        description: '新的项目名称。',
      },
      {
        name: 'brief',
        label: '项目 brief',
        type: 'string',
        required: false,
        description: '新的项目 brief。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '新的项目描述。',
      },
      {
        name: 'phase',
        label: '阶段',
        type: 'string',
        required: false,
        description: '新的项目阶段。',
      },
      {
        name: 'status',
        label: '状态',
        type: 'enum',
        required: false,
        description: '项目状态。',
        options: PROJECT_STATUS_OPTIONS,
      },
      {
        name: 'riskLevel',
        label: '风险级别',
        type: 'enum',
        required: false,
        description: '项目风险级别。',
        options: PROJECT_RISK_OPTIONS,
      },
      {
        name: 'ownerMemberId',
        label: '负责人',
        type: 'string',
        required: false,
        description: '新的负责人 TeamMember ID。',
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: '项目可见性策略。',
        options: VISIBILITY_OPTIONS,
      },
    ],
    sampleInput: {
      projectId: 'project-id',
      brief: '把执行动作、确认和审计统一到一层。',
      phase: 'Execution',
      riskLevel: ProjectRiskLevelValue.MEDIUM,
    },
    buildSummary: (input) =>
      `将更新项目 ${readString(input, 'projectId') ?? '(缺少 projectId)'}。`,
    getTargetId: (input) => readString(input, 'projectId'),
  },
  {
    key: 'create_issue',
    label: '创建任务',
    description: '在当前工作空间创建可执行 Issue。',
    area: 'issue',
    targetType: 'WORKSPACE',
    approvalMode: 'CONFIRM',
    requiresTargetId: false,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'title',
        label: '任务标题',
        type: 'string',
        required: true,
        description: 'Issue 标题。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: 'Issue 描述。',
      },
      {
        name: 'projectId',
        label: '项目 ID',
        type: 'string',
        required: false,
        description: '归属 Project ID。',
      },
      {
        name: 'stateId',
        label: '状态 ID',
        type: 'string',
        required: false,
        description: 'IssueState ID。',
      },
      {
        name: 'priority',
        label: '优先级',
        type: 'enum',
        required: false,
        description: 'Issue 优先级。',
        options: ISSUE_PRIORITY_OPTIONS,
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: 'Issue 可见性。',
        options: VISIBILITY_OPTIONS,
      },
      {
        name: 'assigneeIds',
        label: '协作者',
        type: 'string[]',
        required: false,
        description: '额外 assignee member IDs。',
      },
      {
        name: 'labelIds',
        label: '标签',
        type: 'string[]',
        required: false,
        description: 'Label IDs。',
      },
    ],
    sampleInput: {
      title: '定义 AI action contract',
      description: '补齐动作注册、确认策略与审计记录。',
      priority: IssuePriority.HIGH,
    },
    buildSummary: (input) =>
      `将在当前工作空间创建任务「${readString(input, 'title') ?? '未命名任务'}」。`,
    getTargetId: () => null,
  },
  {
    key: 'update_issue',
    label: '更新任务',
    description: '更新 Issue 的标题、描述或当前步骤状态。',
    area: 'issue',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '任务 ID',
        type: 'string',
        required: true,
        description: '要更新的 Issue ID。',
      },
      {
        name: 'title',
        label: '任务标题',
        type: 'string',
        required: false,
        description: '新的标题。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '新的描述。',
      },
      {
        name: 'currentStepId',
        label: '当前步骤 ID',
        type: 'string',
        required: false,
        description: 'Workflow run 当前步骤 ID。',
      },
      {
        name: 'currentStepIndex',
        label: '当前步骤序号',
        type: 'string',
        required: false,
        description: 'Workflow run 当前步骤序号。',
      },
      {
        name: 'currentStepStatus',
        label: '当前步骤状态',
        type: 'enum',
        required: false,
        description: 'Workflow run 当前步骤状态。',
        options: ['TODO', 'IN_PROGRESS', 'AMOST_DONE', 'BLOCKED', 'DONE'],
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      title: '补齐 AI execution 审计链路',
    },
    buildSummary: (input) =>
      `将更新任务 ${readString(input, 'issueId') ?? '(缺少 issueId)'}。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'attach_coding_prompt_to_issue',
    label: '写入编码交接 Prompt',
    description:
      '把整理好的 coding handoff prompt 回写到 Issue，方便 Claude Code / Codex 接手。',
    area: 'issue',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '任务 ID',
        type: 'string',
        required: true,
        description: '要写入 handoff prompt 的 Issue ID。',
      },
      {
        name: 'prompt',
        label: '编码 Prompt',
        type: 'string',
        required: true,
        description: '可直接交给外部编码 agent 的完整 prompt。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      prompt:
        '# Synaply Coding Handoff\n\n请基于这个 issue 和关联文档继续完成实现。',
    },
    buildSummary: (input) =>
      `将把编码交接 prompt 写入任务 ${readString(input, 'issueId') ?? '(缺少 issueId)'}。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'cancel_issue',
    label: '取消任务',
    description: '将 Issue 软取消，并写入取消活动记录。',
    area: 'issue',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '任务 ID',
        type: 'string',
        required: true,
        description: '要取消的 Issue ID。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
    },
    buildSummary: (input) =>
      `将取消任务 ${readString(input, 'issueId') ?? '(缺少 issueId)'}。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'create_workflow',
    label: '创建工作流',
    description: '创建一个新的 Workflow 模板草稿。',
    area: 'workflow',
    targetType: 'WORKSPACE',
    approvalMode: 'CONFIRM',
    requiresTargetId: false,
    minimumTeamRole: 'ADMIN',
    fields: [
      {
        name: 'name',
        label: '工作流名称',
        type: 'string',
        required: true,
        description: 'Workflow 名称。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: 'Workflow 说明。',
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: 'Workflow 可见性。',
        options: VISIBILITY_OPTIONS,
      },
    ],
    sampleInput: {
      name: '跨角色交接模板',
      description: '需求确认 -> 设计评审 -> 开发接手 -> 发布跟进',
      visibility: VisibilityType.TEAM_READONLY,
    },
    buildSummary: (input) =>
      `将在当前工作空间创建工作流「${readString(input, 'name') ?? '未命名工作流'}」。`,
    getTargetId: () => null,
  },
  {
    key: 'update_workflow',
    label: '更新工作流',
    description: '更新 Workflow 名称、状态、JSON 模板或版本信息。',
    area: 'workflow',
    targetType: 'WORKFLOW',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'workflowId',
        label: '工作流 ID',
        type: 'string',
        required: true,
        description: '要更新的 Workflow ID。',
      },
      {
        name: 'name',
        label: '工作流名称',
        type: 'string',
        required: false,
        description: '新的工作流名称。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '新的工作流描述。',
      },
      {
        name: 'status',
        label: '状态',
        type: 'enum',
        required: false,
        description: 'Workflow 状态。',
        options: ['DRAFT', 'PUBLISHED'],
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: 'Workflow 可见性。',
        options: VISIBILITY_OPTIONS,
      },
      {
        name: 'json',
        label: '模板 JSON',
        type: 'json',
        required: false,
        description: '完整 workflow JSON。',
      },
    ],
    sampleInput: {
      workflowId: 'workflow-id',
      name: '跨角色交接模板 v2',
    },
    buildSummary: (input) =>
      `将更新工作流 ${readString(input, 'workflowId') ?? '(缺少 workflowId)'}。`,
    getTargetId: (input) => readString(input, 'workflowId'),
  },
  {
    key: 'publish_workflow',
    label: '发布工作流',
    description: '将 Workflow 草稿发布为可运行模板。',
    area: 'workflow',
    targetType: 'WORKFLOW',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'workflowId',
        label: '工作流 ID',
        type: 'string',
        required: true,
        description: '要发布的 Workflow ID。',
      },
    ],
    sampleInput: {
      workflowId: 'workflow-id',
    },
    buildSummary: (input) =>
      `将发布工作流 ${readString(input, 'workflowId') ?? '(缺少 workflowId)'}。`,
    getTargetId: (input) => readString(input, 'workflowId'),
  },
  {
    key: 'create_doc',
    label: '创建文档',
    description: '创建 Doc，并可关联 Project / Issue / Workflow。',
    area: 'doc',
    targetType: 'WORKSPACE',
    approvalMode: 'AUTO',
    requiresTargetId: false,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'title',
        label: '文档标题',
        type: 'string',
        required: true,
        description: '文档标题。',
      },
      {
        name: 'content',
        label: '内容快照',
        type: 'string',
        required: false,
        description: 'BlockNote JSON 字符串。',
      },
      {
        name: 'parentDocument',
        label: '父级文档',
        type: 'string',
        required: false,
        description: '父级文件夹 ID。',
      },
      {
        name: 'projectId',
        label: '项目 ID',
        type: 'string',
        required: false,
        description: '关联 Project ID。',
      },
      {
        name: 'issueId',
        label: '任务 ID',
        type: 'string',
        required: false,
        description: '关联 Issue ID。',
      },
      {
        name: 'workflowId',
        label: '工作流 ID',
        type: 'string',
        required: false,
        description: '关联 Workflow ID。',
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: 'Doc 可见性。',
        options: VISIBILITY_OPTIONS,
      },
    ],
    sampleInput: {
      title: 'AI 执行层设计纪要',
      content:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"记录 action contract、审批策略和审计约束。"}]}]}',
    },
    buildSummary: (input) =>
      `将在当前工作空间创建文档「${readString(input, 'title') ?? '未命名文档'}」。`,
    getTargetId: () => null,
  },
  {
    key: 'update_doc_meta',
    label: '更新文档元信息',
    description: '更新文档标题、图标、封面和可见性。',
    area: 'doc',
    targetType: 'DOC',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'docId',
        label: '文档 ID',
        type: 'string',
        required: true,
        description: '要更新的 Doc ID。',
      },
      {
        name: 'title',
        label: '标题',
        type: 'string',
        required: false,
        description: '新的文档标题。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '文件夹描述。',
      },
      {
        name: 'icon',
        label: '图标',
        type: 'string',
        required: false,
        description: '文档图标。',
      },
      {
        name: 'coverImage',
        label: '封面图',
        type: 'string',
        required: false,
        description: '封面图 URL。',
      },
      {
        name: 'visibility',
        label: '可见性',
        type: 'enum',
        required: false,
        description: 'Doc 可见性。',
        options: VISIBILITY_OPTIONS,
      },
    ],
    sampleInput: {
      docId: 'doc-id',
      title: 'AI 执行层建设纪要',
    },
    buildSummary: (input) =>
      `将更新文档 ${readString(input, 'docId') ?? '(缺少 docId)'}。`,
    getTargetId: (input) => readString(input, 'docId'),
  },
  {
    key: 'create_doc_revision',
    label: '提交文档修订',
    description: '为文档创建新的 revision，并更新最新内容快照。',
    area: 'doc',
    targetType: 'DOC',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'docId',
        label: '文档 ID',
        type: 'string',
        required: true,
        description: '要提交修订的 Doc ID。',
      },
      {
        name: 'contentSnapshot',
        label: '内容快照',
        type: 'string',
        required: true,
        description: 'BlockNote JSON 字符串。',
      },
      {
        name: 'metadataSnapshot',
        label: '元数据快照',
        type: 'string',
        required: false,
        description: '文档元数据 JSON 字符串。',
      },
      {
        name: 'baseRevisionId',
        label: '基线修订 ID',
        type: 'string',
        required: false,
        description: '客户端编辑所基于的 revision ID。',
      },
      {
        name: 'clientMutationId',
        label: '幂等 ID',
        type: 'string',
        required: false,
        description: '可选；未提供时会自动生成。',
      },
      {
        name: 'changeSource',
        label: '变更来源',
        type: 'enum',
        required: false,
        description: '修订来源类型。',
        options: DOC_CHANGE_SOURCE_OPTIONS,
      },
    ],
    sampleInput: {
      docId: 'doc-id',
      contentSnapshot:
        '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"补充 AI execution action matrix。"}]}]}',
      metadataSnapshot: '{"title":"AI 执行层建设纪要"}',
    },
    buildSummary: (input) =>
      `将为文档 ${readString(input, 'docId') ?? '(缺少 docId)'} 提交新修订。`,
    getTargetId: (input) => readString(input, 'docId'),
  },
  {
    key: 'create_workflow_run',
    label: '创建工作流运行实例',
    description: '基于已发布模板创建 Workflow run Issue。',
    area: 'workflow',
    targetType: 'WORKFLOW',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'workflowId',
        label: '工作流模板 ID',
        type: 'string',
        required: true,
        description: '已发布 Workflow 模板 ID。',
      },
      {
        name: 'title',
        label: '运行实例标题',
        type: 'string',
        required: true,
        description: 'Workflow run 对应的 Issue 标题。',
      },
      {
        name: 'description',
        label: '描述',
        type: 'string',
        required: false,
        description: '运行实例描述。',
      },
      {
        name: 'projectId',
        label: '项目 ID',
        type: 'string',
        required: false,
        description: '归属项目。',
      },
      {
        name: 'priority',
        label: '优先级',
        type: 'enum',
        required: false,
        description: 'Issue 优先级。',
        options: ISSUE_PRIORITY_OPTIONS,
      },
    ],
    sampleInput: {
      workflowId: 'workflow-id',
      title: 'AI 执行层第一阶段推进',
      description: '驱动审计、确认和能力面板上线。',
      priority: IssuePriority.HIGH,
    },
    buildSummary: (input) =>
      `将基于工作流 ${readString(input, 'workflowId') ?? '(缺少 workflowId)'} 创建运行实例「${readString(input, 'title') ?? '未命名运行'}」。`,
    getTargetId: (input) => readString(input, 'workflowId'),
  },
  {
    key: 'update_workflow_run_status',
    label: '更新流程步骤状态',
    description: '更新当前 workflow run 步骤的状态，并写入活动记录。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'status',
        label: '步骤状态',
        type: 'enum',
        required: true,
        description: '当前步骤要切换到的状态。',
        options: ISSUE_STATUS_OPTIONS,
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '状态变化的补充说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      status: IssueStatus.IN_PROGRESS,
      comment: '进入执行中。',
    },
    buildSummary: (input) =>
      `将更新 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 的步骤状态。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'advance_workflow_run',
    label: '推进流程到下一步',
    description: '完成当前步骤并推进 workflow run 到下一节点。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'resultText',
        label: '成果摘要',
        type: 'string',
        required: false,
        description: '推进前记录的成果摘要。',
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '推进备注。',
      },
      {
        name: 'attachments',
        label: '附件',
        type: 'json',
        required: false,
        description: '步骤记录附件 payload。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      resultText: 'action contract 与 audit schema 已对齐。',
      comment: '推进到下一个评审节点。',
    },
    buildSummary: (input) =>
      `将推进 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 到下一步。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'revert_workflow_run',
    label: '回退流程到上一步',
    description: '将当前 workflow run 回退到上一节点。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'comment',
        label: '回退说明',
        type: 'string',
        required: false,
        description: '为什么需要回退。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      comment: '上一轮 review 要求返回设计修订。',
    },
    buildSummary: (input) =>
      `将回退 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 到上一步。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'block_workflow_run',
    label: '阻塞流程步骤',
    description: '将当前 workflow run 步骤标记为阻塞状态。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'reason',
        label: '阻塞原因',
        type: 'string',
        required: false,
        description: '当前步骤被阻塞的原因。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      reason: '等待产品确认需求边界。',
    },
    buildSummary: (input) =>
      `将把 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 标记为阻塞。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'unblock_workflow_run',
    label: '解除流程阻塞',
    description: '解除当前 workflow run 步骤阻塞并恢复到指定状态。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'restoreStatus',
        label: '恢复状态',
        type: 'enum',
        required: false,
        description: '解除阻塞后恢复到的步骤状态。',
        options: ISSUE_STATUS_OPTIONS,
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '解除阻塞说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      restoreStatus: IssueStatus.IN_PROGRESS,
      comment: '依赖已满足，继续执行。',
    },
    buildSummary: (input) =>
      `将解除 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 的阻塞。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'request_workflow_review',
    label: '请求流程评审',
    description: '为当前 workflow run 步骤请求 review。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'targetUserId',
        label: '评审人 User ID',
        type: 'string',
        required: true,
        description: '目标评审人 User ID。',
      },
      {
        name: 'targetName',
        label: '评审人名称',
        type: 'string',
        required: false,
        description: '评审人展示名称。',
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '补充说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      targetUserId: 'user-id',
      targetName: '设计负责人',
      comment: '请确认 action contract 是否覆盖 review / handoff。',
    },
    buildSummary: (input) =>
      `将为 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 请求 review。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'respond_workflow_review',
    label: '响应流程评审',
    description: '对待处理的 workflow run review 做出通过或要求修改的回应。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'outcome',
        label: '评审结论',
        type: 'enum',
        required: true,
        description: 'review 的结果。',
        options: WORKFLOW_REVIEW_OUTCOME_OPTIONS,
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '评审说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      outcome: WorkflowReviewOutcome.APPROVED,
      comment: '可以继续进入下一步。',
    },
    buildSummary: (input) =>
      `将响应 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 的 review。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'request_workflow_handoff',
    label: '请求流程交接',
    description: '为当前 workflow run 步骤发起 handoff 请求。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'targetUserId',
        label: '接手人 User ID',
        type: 'string',
        required: true,
        description: '目标接手人 User ID。',
      },
      {
        name: 'targetName',
        label: '接手人名称',
        type: 'string',
        required: false,
        description: '接手人展示名称。',
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '交接说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      targetUserId: 'user-id',
      targetName: '工程负责人',
      comment: '设计 review 已通过，请接手实现。',
    },
    buildSummary: (input) =>
      `将为 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 请求 handoff。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'accept_workflow_handoff',
    label: '接受流程交接',
    description: '接受待处理的 workflow run handoff，并接手当前步骤。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'CONFIRM',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'comment',
        label: '附言',
        type: 'string',
        required: false,
        description: '接手说明。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      comment: '我来接手实现阶段。',
    },
    buildSummary: (input) =>
      `将接受 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 的 handoff。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'submit_workflow_record',
    label: '提交流程成果记录',
    description: '为当前 workflow run 步骤提交成果记录。',
    area: 'workflow',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '运行实例 ID',
        type: 'string',
        required: true,
        description: 'Workflow run Issue ID。',
      },
      {
        name: 'resultText',
        label: '成果摘要',
        type: 'string',
        required: false,
        description: '步骤产出摘要。',
      },
      {
        name: 'attachments',
        label: '附件',
        type: 'json',
        required: false,
        description: '附件 payload。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      resultText: '实现稿与回归说明已提交。',
    },
    buildSummary: (input) =>
      `将为 workflow run ${readString(input, 'issueId') ?? '(缺少 issueId)'} 提交成果记录。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
  {
    key: 'create_comment',
    label: '添加评论',
    description: '在指定 Issue 下添加评论或回复。',
    area: 'issue',
    targetType: 'ISSUE',
    approvalMode: 'AUTO',
    requiresTargetId: true,
    minimumTeamRole: 'MEMBER',
    fields: [
      {
        name: 'issueId',
        label: '任务 ID',
        type: 'string',
        required: true,
        description: '要评论的 Issue ID。',
      },
      {
        name: 'content',
        label: '评论内容',
        type: 'string',
        required: true,
        description: '评论正文。',
      },
      {
        name: 'parentId',
        label: '父评论 ID',
        type: 'string',
        required: false,
        description: '用于回复已有评论。',
      },
    ],
    sampleInput: {
      issueId: 'issue-id',
      content: '这一步的审计和确认链已经闭合，可以进入联调。',
    },
    buildSummary: (input) =>
      `将为任务 ${readString(input, 'issueId') ?? '(缺少 issueId)'} 添加评论。`,
    getTargetId: (input) => readString(input, 'issueId'),
  },
];

type AiExecutionRecordRow = {
  id: string;
  action_key: string;
  status: AiExecutionStatus;
  approval_mode: AiApprovalMode;
  target_type: AiExecutionTargetType | null;
  target_id: string | null;
  summary: string | null;
  conversation_id: string | null;
  created_at: Date | string;
  completed_at: Date | string | null;
  input: Prisma.JsonValue | null;
  result: Prisma.JsonValue | null;
  error: Prisma.JsonValue | null;
};

@Injectable()
export class AiExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamMemberService: TeamMemberService,
    private readonly projectService: ProjectService,
    private readonly issueService: IssueService,
    private readonly docService: DocService,
    private readonly workflowService: WorkflowService,
    private readonly commentService: CommentService,
  ) {}

  async getCapabilities(workspaceId: string, userId: string) {
    const actorContext = await this.buildActorContext(workspaceId, userId);

    return {
      workspaceId,
      workspaceType: actorContext.workspaceType,
      actorRole: actorContext.actorRole,
      actions: ACTION_DEFINITIONS.map((definition) => ({
        ...this.serializeDefinition(definition),
        availability: this.resolveAvailability(definition, actorContext),
      })),
    };
  }

  /**
   * 输出机器可读的 capability manifest，供 Next.js agent runtime 启动时拉取，
   * 用来动态生成 AI SDK 的 typed tool 定义。
   *
   * 与 getCapabilities 的区别：
   *  - 每个 action 包含 `parametersSchema`：JSON Schema 描述，可直接喂给
   *    Anthropic / AI SDK 的 tool definition。
   *  - 包含 `minimumTeamRole`，方便 Next 决定是否在 prompt 里隐藏某个工具。
   *  - 不返回 actorRole / availability —— 这些由 Next runtime 在调用时按
   *    实际用户重新读 getCapabilities。
   *
   * 这个端点没有 PII，但仍然走 workspace auth 与现有约定保持一致。
   */
  async getActionManifest(workspaceId: string, userId: string) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    return {
      workspaceId,
      version: 1,
      generatedAt: new Date().toISOString(),
      actions: ACTION_DEFINITIONS.map((definition) => ({
        key: definition.key,
        label: definition.label,
        description: definition.description,
        area: definition.area,
        targetType: definition.targetType,
        approvalMode: definition.approvalMode,
        requiresTargetId: definition.requiresTargetId,
        minimumTeamRole: definition.minimumTeamRole,
        fields: definition.fields,
        parametersSchema: this.buildJsonSchema(definition),
        sampleInput: definition.sampleInput,
      })),
    };
  }

  private buildJsonSchema(definition: AiActionDefinition) {
    const properties: Record<string, Record<string, unknown>> = {};
    const required: string[] = [];

    for (const field of definition.fields) {
      properties[field.name] = this.fieldToJsonSchema(field);
      if (field.required) {
        required.push(field.name);
      }
    }

    return {
      type: 'object' as const,
      properties,
      required,
      additionalProperties: false,
    };
  }

  private fieldToJsonSchema(
    field: AiActionDefinition['fields'][number],
  ): Record<string, unknown> {
    switch (field.type) {
      case 'string':
        return { type: 'string', description: field.description };
      case 'string[]':
        return {
          type: 'array',
          items: { type: 'string' },
          description: field.description,
        };
      case 'enum':
        return {
          type: 'string',
          enum: field.options ?? [],
          description: field.description,
        };
      case 'date':
        return {
          type: 'string',
          format: 'date-time',
          description: field.description,
        };
      case 'json':
      default:
        return {
          type: 'object',
          additionalProperties: true,
          description: field.description,
        };
    }
  }

  async listExecutions(workspaceId: string, userId: string, limit = 20) {
    await this.teamMemberService.validateWorkspaceAccess(userId, workspaceId);

    const records = await this.prisma.$queryRaw<AiExecutionRecordRow[]>(
      Prisma.sql`
        SELECT
          "id",
          "action_key",
          "status",
          "approval_mode",
          "target_type",
          "target_id",
          "summary",
          "conversation_id",
          "created_at",
          "completed_at",
          "input",
          "result",
          "error"
        FROM "ai_execution_records"
        WHERE "workspace_id" = ${workspaceId}
        ORDER BY "created_at" DESC
        LIMIT ${limit}
      `,
    );

    return records.map((record) => {
      const definition = ACTION_DEFINITIONS.find(
        (item) => item.key === record.action_key,
      );

      return {
        id: record.id,
        actionKey: record.action_key,
        actionLabel: definition?.label ?? record.action_key,
        area: definition?.area ?? 'issue',
        status: record.status,
        approvalMode: record.approval_mode,
        targetType: record.target_type,
        targetId: record.target_id,
        summary: record.summary,
        conversationId: record.conversation_id,
        createdAt: new Date(record.created_at).toISOString(),
        completedAt: record.completed_at
          ? new Date(record.completed_at).toISOString()
          : null,
        input: record.input ? toSerializable(record.input) : null,
        result: record.result ? toSerializable(record.result) : null,
        error: record.error ? toSerializable(record.error) : null,
      };
    });
  }

  async executeAction(
    workspaceId: string,
    actionKey: string,
    input: Record<string, unknown> | undefined,
    userId: string,
    options?: {
      dryRun?: boolean;
      confirmed?: boolean;
      conversationId?: string;
    },
  ) {
    const definition = this.findActionDefinition(actionKey);
    const actorContext = await this.buildActorContext(workspaceId, userId);
    const availability = this.resolveAvailability(definition, actorContext);
    const normalizedInput = this.normalizeActionInput(
      definition,
      this.ensureInputObject(input),
    );
    const summary = definition.buildSummary(normalizedInput);
    const targetId = definition.getTargetId(normalizedInput);
    const baseResponse = {
      action: {
        ...this.serializeDefinition(definition),
        availability,
      },
      summary,
      targetId,
      approvalMode: definition.approvalMode,
    };

    if (availability.status === 'unavailable') {
      const record = await this.createExecutionRecord({
        workspaceId,
        actorUserId: userId,
        actionKey: definition.key,
        status: 'BLOCKED',
        approvalMode: definition.approvalMode,
        targetType: definition.targetType,
        targetId,
        summary,
        conversationId: options?.conversationId,
        input: normalizedInput,
        error: {
          message: availability.reason ?? '当前身份无法执行该动作。',
        },
      });

      return {
        ...baseResponse,
        executionId: record.id,
        status: 'blocked',
        needsConfirmation: false,
        message: availability.reason ?? '当前身份无法执行该动作。',
      };
    }

    if (
      options?.dryRun ||
      (definition.approvalMode === 'CONFIRM' && !options?.confirmed)
    ) {
      const message = options?.dryRun
        ? '已完成预演，尚未写入任何真实对象。'
        : '该动作需要确认后才能执行。';
      const record = await this.createExecutionRecord({
        workspaceId,
        actorUserId: userId,
        actionKey: definition.key,
        status: 'PREVIEW',
        approvalMode: definition.approvalMode,
        targetType: definition.targetType,
        targetId,
        summary,
        conversationId: options?.conversationId,
        input: normalizedInput,
        result: {
          preview: true,
          needsConfirmation:
            definition.approvalMode === 'CONFIRM' && !options?.confirmed,
        },
      });

      return {
        ...baseResponse,
        executionId: record.id,
        status: 'preview',
        needsConfirmation:
          definition.approvalMode === 'CONFIRM' && !options?.confirmed,
        message,
      };
    }

    try {
      const result = await this.dispatchAction(
        definition.key,
        workspaceId,
        userId,
        normalizedInput,
      );
      const normalizedResult = toSerializable(result);
      const record = await this.createExecutionRecord({
        workspaceId,
        actorUserId: userId,
        actionKey: definition.key,
        status: 'SUCCEEDED',
        approvalMode: definition.approvalMode,
        targetType: definition.targetType,
        targetId,
        summary,
        conversationId: options?.conversationId,
        input: normalizedInput,
        result: normalizedResult,
      });

      return {
        ...baseResponse,
        executionId: record.id,
        status: 'succeeded',
        needsConfirmation: false,
        message: '动作执行成功。',
        result: normalizedResult,
      };
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      const record = await this.createExecutionRecord({
        workspaceId,
        actorUserId: userId,
        actionKey: definition.key,
        status: normalizedError.statusCode === 403 ? 'BLOCKED' : 'FAILED',
        approvalMode: definition.approvalMode,
        targetType: definition.targetType,
        targetId,
        summary,
        conversationId: options?.conversationId,
        input: normalizedInput,
        error: normalizedError,
      });

      return {
        ...baseResponse,
        executionId: record.id,
        status: normalizedError.statusCode === 403 ? 'blocked' : 'failed',
        needsConfirmation: false,
        message: normalizedError.message,
        error: normalizedError,
      };
    }
  }

  private serializeDefinition(definition: AiActionDefinition) {
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      area: definition.area,
      targetType: definition.targetType,
      approvalMode: definition.approvalMode,
      requiresTargetId: definition.requiresTargetId,
      fields: definition.fields,
      sampleInput: definition.sampleInput,
    };
  }

  private async buildActorContext(
    workspaceId: string,
    userId: string,
  ): Promise<AiActionActorContext> {
    const { workspace } = await this.teamMemberService.validateWorkspaceAccess(
      userId,
      workspaceId,
    );

    const actorRole =
      workspace.type === 'TEAM'
        ? (workspace.team.members.find(
            (member: any) => member.userId === userId,
          )?.role ?? Role.MEMBER)
        : Role.OWNER;

    return {
      workspaceId,
      workspaceType: workspace.type,
      actorUserId: userId,
      actorRole,
    };
  }

  private resolveAvailability(
    definition: AiActionDefinition,
    actorContext: AiActionActorContext,
  ): AiActionAvailability {
    if (
      actorContext.workspaceType === 'TEAM' &&
      definition.minimumTeamRole === 'ADMIN' &&
      actorContext.actorRole === Role.MEMBER
    ) {
      return {
        status: 'unavailable',
        reason: '当前动作只允许 OWNER / ADMIN 让 AI 代为执行。',
      };
    }

    if (definition.requiresTargetId) {
      return {
        status: 'requires_target_check',
        reason: '需要结合目标对象的真实权限进一步校验。',
      };
    }

    return {
      status: 'available',
    };
  }

  private findActionDefinition(actionKey: string) {
    const definition = ACTION_DEFINITIONS.find(
      (item) => item.key === actionKey,
    );
    if (!definition) {
      throw new BadRequestException(`未知 AI 动作: ${actionKey}`);
    }

    return definition;
  }

  private ensureInputObject(input?: Record<string, unknown>) {
    if (!input) {
      return {};
    }

    if (typeof input !== 'object' || Array.isArray(input)) {
      throw new BadRequestException('动作输入必须是 JSON object。');
    }

    return input;
  }

  private normalizeActionInput(
    definition: AiActionDefinition,
    input: Record<string, unknown>,
  ) {
    let normalizedInput = input;

    for (const field of definition.fields) {
      if (
        field.type !== 'enum' ||
        !field.options ||
        !(field.name in normalizedInput)
      ) {
        continue;
      }

      const normalizedValue = this.normalizeEnumValue(
        normalizedInput[field.name],
        field.options,
      );

      if (normalizedValue === normalizedInput[field.name]) {
        continue;
      }

      normalizedInput = {
        ...normalizedInput,
        [field.name]: normalizedValue,
      };
    }

    return normalizedInput;
  }

  private normalizeEnumValue(value: unknown, options: string[]) {
    if (typeof value !== 'string' || options.length === 0) {
      return value;
    }

    const trimmedValue = value.trim();
    const exactMatch = options.find((option) => option === trimmedValue);
    if (exactMatch) {
      return exactMatch;
    }

    const optionMap = new Map(
      options.map((option) => [normalizeEnumToken(option), option]),
    );
    const normalizedKey = normalizeEnumToken(trimmedValue);
    const aliasedKey = ENUM_ALIAS_MAP[normalizedKey] ?? normalizedKey;

    return optionMap.get(aliasedKey) ?? value;
  }

  private parseDto<T extends object>(
    dtoClass: new () => T,
    payload: Record<string, unknown>,
  ): T {
    const instance = plainToInstance(dtoClass, payload);
    const errors = validateSync(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      throw new BadRequestException(formatValidationErrors(errors).join('; '));
    }

    return instance;
  }

  private requireId(
    payload: Record<string, unknown>,
    key: string,
    label: string,
  ) {
    const value = readString(payload, key);
    if (!value) {
      throw new BadRequestException(`${label}不能为空`);
    }

    return value;
  }

  private omitKeys(
    payload: Record<string, unknown>,
    keys: string[],
  ): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(payload).filter(([key]) => !keys.includes(key)),
    );
  }

  private async dispatchAction(
    actionKey: AiActionKey,
    workspaceId: string,
    userId: string,
    payload: Record<string, unknown>,
  ) {
    switch (actionKey) {
      case 'create_project': {
        const dto = this.parseDto(CreateProjectDto, payload);
        return this.projectService.create(workspaceId, dto, userId);
      }

      case 'update_project': {
        const projectId = this.requireId(payload, 'projectId', 'projectId');
        const dto = this.parseDto(
          UpdateProjectDto,
          this.omitKeys(payload, ['projectId']),
        );
        return this.projectService.update(workspaceId, projectId, dto, userId);
      }

      case 'create_issue': {
        const dto = this.parseDto(CreateIssueDto, {
          ...payload,
          workspaceId,
        });
        return this.issueService.create(userId, dto);
      }

      case 'update_issue': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          UpdateIssueDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.update(userId, workspaceId, issueId, dto);
      }

      case 'attach_coding_prompt_to_issue': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const prompt = this.requireId(payload, 'prompt', 'prompt');

        return this.issueService.update(userId, workspaceId, issueId, {
          aiHandoffPrompt: prompt,
          aiHandoffPromptUpdatedAt: new Date(),
        });
      }

      case 'cancel_issue': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        return this.issueService.cancel(userId, workspaceId, issueId);
      }

      case 'create_workflow': {
        const dto = this.parseDto(CreateWorkflowDto, payload);
        return this.workflowService.create(workspaceId, dto, userId);
      }

      case 'update_workflow': {
        const workflowId = this.requireId(payload, 'workflowId', 'workflowId');
        const dto = this.parseDto(
          UpdateWorkflowDto,
          this.omitKeys(payload, ['workflowId']),
        );
        return this.workflowService.update(workflowId, dto, userId);
      }

      case 'publish_workflow': {
        const workflowId = this.requireId(payload, 'workflowId', 'workflowId');
        return this.workflowService.publish(workflowId, userId);
      }

      case 'create_doc': {
        const dto = this.parseDto(CreateDocDto, payload);
        return this.docService.create(workspaceId, dto, userId);
      }

      case 'update_doc_meta': {
        const docId = this.requireId(payload, 'docId', 'docId');
        const dto = this.parseDto(
          UpdateDocMetaDto,
          this.omitKeys(payload, ['docId']),
        );
        return this.docService.updateMeta(workspaceId, docId, dto, userId);
      }

      case 'create_doc_revision': {
        const docId = this.requireId(payload, 'docId', 'docId');
        const dto = this.parseDto(CreateDocRevisionDto, {
          ...this.omitKeys(payload, ['docId']),
          clientMutationId:
            readString(payload, 'clientMutationId') ??
            `ai-execution:${docId}:${randomUUID()}`,
        });
        return this.docService.createRevision(workspaceId, docId, dto, userId);
      }

      case 'create_workflow_run': {
        const dto = this.parseDto(CreateWorkflowIssueDto, {
          ...payload,
          workspaceId,
        });
        return this.issueService.createWorkflowIssue(userId, dto);
      }

      case 'update_workflow_run_status': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          UpdateWorkflowRunStatusDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.updateWorkflowRunStatus(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'advance_workflow_run': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          AdvanceWorkflowRunDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.advanceWorkflowRun(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'revert_workflow_run': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          RevertWorkflowRunDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.revertWorkflowRun(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'block_workflow_run': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          BlockWorkflowRunDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.blockWorkflowRun(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'unblock_workflow_run': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          UnblockWorkflowRunDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.unblockWorkflowRun(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'request_workflow_review': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          RequestWorkflowReviewDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.requestWorkflowReview(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'respond_workflow_review': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          RespondWorkflowReviewDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.respondWorkflowReview(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'request_workflow_handoff': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          RequestWorkflowHandoffDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.requestWorkflowHandoff(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'accept_workflow_handoff': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          AcceptWorkflowHandoffDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.acceptWorkflowHandoff(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'submit_workflow_record': {
        const issueId = this.requireId(payload, 'issueId', 'issueId');
        const dto = this.parseDto(
          SubmitWorkflowRecordDto,
          this.omitKeys(payload, ['issueId']),
        );
        return this.issueService.submitWorkflowRecord(
          userId,
          workspaceId,
          issueId,
          dto,
        );
      }

      case 'create_comment': {
        const dto = this.parseDto(CreateCommentDto, {
          ...payload,
          workspaceId,
        });
        return this.commentService.create(dto, userId);
      }

      default:
        throw new BadRequestException(`暂不支持动作 ${actionKey}`);
    }
  }

  private normalizeError(error: unknown) {
    if (error instanceof HttpException) {
      const statusCode = error.getStatus();
      const response = error.getResponse();
      const responseMessage =
        typeof response === 'string'
          ? response
          : Array.isArray((response as any)?.message)
            ? (response as any).message.join('; ')
            : (response as any)?.message;

      return {
        name: error.name,
        message: responseMessage || error.message,
        statusCode,
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        statusCode: 500,
      };
    }

    return {
      name: 'UnknownError',
      message: '发生未知错误',
      statusCode: 500,
    };
  }

  private async createExecutionRecord(params: {
    workspaceId: string;
    actorUserId: string;
    actionKey: string;
    status: AiExecutionStatus;
    approvalMode: AiApprovalMode;
    targetType: AiExecutionTargetType;
    targetId: string | null;
    summary: string;
    conversationId?: string;
    input?: Record<string, unknown>;
    result?: unknown;
    error?: unknown;
  }) {
    const recordId = randomUUID();

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "ai_execution_records" (
          "id",
          "workspace_id",
          "actor_user_id",
          "action_key",
          "status",
          "approval_mode",
          "target_type",
          "target_id",
          "summary",
          "conversation_id",
          "input",
          "result",
          "error",
          "completed_at"
        )
        VALUES (
          ${recordId},
          ${params.workspaceId},
          ${params.actorUserId},
          ${params.actionKey},
          ${params.status}::"AiExecutionStatus",
          ${params.approvalMode}::"AiApprovalMode",
          ${params.targetType}::"AiExecutionTargetType",
          ${params.targetId},
          ${params.summary},
          ${params.conversationId ?? null},
          ${
            params.input !== undefined
              ? JSON.stringify(toSerializable(params.input))
              : null
          }::jsonb,
          ${
            params.result !== undefined
              ? JSON.stringify(toSerializable(params.result))
              : null
          }::jsonb,
          ${
            params.error !== undefined
              ? JSON.stringify(toSerializable(params.error))
              : null
          }::jsonb,
          NOW()
        )
      `,
    );

    return { id: recordId };
  }
}
