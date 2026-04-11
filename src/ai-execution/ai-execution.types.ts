import { Role } from '../../prisma/generated/prisma/client';

export const AI_ACTION_KEYS = [
  'create_project',
  'update_project',
  'create_issue',
  'update_issue',
  'attach_coding_prompt_to_issue',
  'cancel_issue',
  'create_workflow',
  'update_workflow',
  'publish_workflow',
  'create_doc',
  'update_doc_meta',
  'create_doc_revision',
  'create_workflow_run',
  'update_workflow_run_status',
  'advance_workflow_run',
  'revert_workflow_run',
  'block_workflow_run',
  'unblock_workflow_run',
  'request_workflow_review',
  'respond_workflow_review',
  'request_workflow_handoff',
  'accept_workflow_handoff',
  'submit_workflow_record',
  'create_comment',
] as const;

export type AiActionKey = (typeof AI_ACTION_KEYS)[number];

export type AiActionArea = 'project' | 'issue' | 'workflow' | 'doc';

export type AiApprovalMode = 'AUTO' | 'CONFIRM';

export type AiExecutionStatus = 'PREVIEW' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED';

export type AiExecutionTargetType =
  | 'WORKSPACE'
  | 'PROJECT'
  | 'ISSUE'
  | 'WORKFLOW'
  | 'DOC';

export type AiActionAvailabilityStatus =
  | 'available'
  | 'requires_target_check'
  | 'unavailable';

export interface AiActionFieldDescriptor {
  name: string;
  label: string;
  type: 'string' | 'string[]' | 'enum' | 'json' | 'date';
  required: boolean;
  description: string;
  options?: string[];
}

export interface AiActionActorContext {
  workspaceId: string;
  workspaceType: 'PERSONAL' | 'TEAM';
  actorUserId: string;
  actorRole: Role;
}

export interface AiActionAvailability {
  status: AiActionAvailabilityStatus;
  reason?: string;
}

export interface AiActionDefinition {
  key: AiActionKey;
  label: string;
  description: string;
  area: AiActionArea;
  targetType: AiExecutionTargetType;
  approvalMode: AiApprovalMode;
  requiresTargetId: boolean;
  minimumTeamRole: 'MEMBER' | 'ADMIN';
  fields: AiActionFieldDescriptor[];
  sampleInput: Record<string, unknown>;
  buildSummary: (input: Record<string, unknown>) => string;
  getTargetId: (input: Record<string, unknown>) => string | null;
}
