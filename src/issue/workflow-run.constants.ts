export const WORKFLOW_RUN_EVENT_TYPES = {
  RUN_CREATED: 'workflow.run.created',
  STEP_STARTED: 'workflow.step.started',
  STEP_STATUS_CHANGED: 'workflow.step.status_changed',
  STEP_COMPLETED: 'workflow.step.completed',
  STEP_REVERTED: 'workflow.step.reverted',
  RECORD_SUBMITTED: 'workflow.record.submitted',
  REVIEW_REQUESTED: 'workflow.review.requested',
  REVIEW_APPROVED: 'workflow.review.approved',
  REVIEW_CHANGES_REQUESTED: 'workflow.review.changes_requested',
  HANDOFF_REQUESTED: 'workflow.handoff.requested',
  HANDOFF_ACCEPTED: 'workflow.handoff.accepted',
  BLOCKED: 'workflow.blocked',
  UNBLOCKED: 'workflow.unblocked',
  RUN_COMPLETED: 'workflow.run.completed',
} as const;

export type WorkflowRunEventType =
  (typeof WORKFLOW_RUN_EVENT_TYPES)[keyof typeof WORKFLOW_RUN_EVENT_TYPES];

export const WORKFLOW_RUN_STATUSES = {
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
  WAITING_REVIEW: 'WAITING_REVIEW',
  HANDOFF_PENDING: 'HANDOFF_PENDING',
  DONE: 'DONE',
} as const;

export type WorkflowRunStatus =
  (typeof WORKFLOW_RUN_STATUSES)[keyof typeof WORKFLOW_RUN_STATUSES];

export const WORKFLOW_ACTION_TYPES = {
  EXECUTION: 'execution',
  BLOCKED: 'blocked',
  REVIEW: 'review',
  HANDOFF: 'handoff',
  DONE: 'done',
} as const;

export type WorkflowActionType =
  (typeof WORKFLOW_ACTION_TYPES)[keyof typeof WORKFLOW_ACTION_TYPES];

export interface WorkflowActivityMetadata {
  kind: 'workflow';
  eventType: WorkflowRunEventType;
  runStatus: WorkflowRunStatus;
  actionType: WorkflowActionType;
  templateId?: string | null;
  templateVersion?: string | null;
  currentStepId?: string | null;
  currentStepName?: string | null;
  currentStepIndex?: number | null;
  previousStepId?: string | null;
  previousStepName?: string | null;
  nextStepId?: string | null;
  nextStepName?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  targetUserId?: string | null;
  targetName?: string | null;
  reason?: string | null;
  comment?: string | null;
  resultText?: string | null;
}
