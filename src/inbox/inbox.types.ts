export const INBOX_ITEM_TYPES = [
  'workflow.review.requested',
  'workflow.handoff.requested',
  'workflow.blocked',
  'doc.review.ready',
  'doc.handoff.ready',
  'issue.assigned',
  'issue.canceled',
  'doc.release.updated',
  'project.risk.flagged',
  'doc.decision.updated',
  'deadline.soon',
  'digest.generated',
] as const;

export type InboxItemType = (typeof INBOX_ITEM_TYPES)[number];

export const INBOX_BUCKETS = [
  'needs-response',
  'needs-attention',
  'following',
  'digest',
] as const;

export type InboxBucket = (typeof INBOX_BUCKETS)[number];

export const INBOX_ITEM_STATUSES = [
  'unread',
  'seen',
  'done',
  'dismissed',
  'snoozed',
] as const;

export type InboxItemStatus = (typeof INBOX_ITEM_STATUSES)[number];

export const INBOX_ITEM_PRIORITIES = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;

export type InboxItemPriority = (typeof INBOX_ITEM_PRIORITIES)[number];

export const INBOX_SOURCE_TYPES = [
  'issue',
  'workflow',
  'project',
  'doc',
] as const;

export type InboxSourceType = (typeof INBOX_SOURCE_TYPES)[number];

export const INBOX_ACTION_KEYS = [
  'open',
  'toggle_read',
  'mark_done',
  'snooze',
  'accept_handoff',
] as const;

export type InboxActionKey = (typeof INBOX_ACTION_KEYS)[number];

export interface InboxActionDefinition {
  key: InboxActionKey;
  label: string;
}

export interface InboxSummary {
  needsResponse: number;
  needsAttention: number;
  following: number;
  digest: number;
  unread: number;
  snoozed: number;
  done: number;
}

export interface InboxFeedItem {
  id: string;
  type: InboxItemType;
  bucket: InboxBucket;
  title: string;
  summary: string | null;
  priority: InboxItemPriority;
  status: InboxItemStatus;
  requiresAction: boolean;
  sourceType: InboxSourceType;
  sourceId: string;
  projectId: string | null;
  projectName: string | null;
  issueId: string | null;
  issueKey: string | null;
  workflowRunId: string | null;
  docId: string | null;
  actionLabel: string | null;
  occurredAt: string;
  metadata: Record<string, unknown> | null;
  availableActions: InboxActionDefinition[];
}

export interface InboxFeedResponse {
  workspaceId: string;
  generatedAt: string;
  summary: InboxSummary;
  items: InboxFeedItem[];
  nextCursor: string | null;
}

export interface MyWorkInboxSignal {
  id: string;
  type: InboxItemType;
  title: string;
  projectName: string | null;
  actionLabel: string | null;
  priority: InboxItemPriority;
  occurredAt: string;
  requiresAction: boolean;
}
