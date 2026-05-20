import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  status: text('status').notNull(), // 'pending', 'running', 'done', 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  sessionType: text('session_type').notNull().default('omni'),
  mode: text('mode').notNull().default('implementation'),
  projectPath: text('project_path'),
  title: text('title'),
  preferredWorkerType: text('preferred_worker_type'),
  preferredWorkerModel: text('preferred_worker_model'),
  preferredWorkerEffort: text('preferred_worker_effort'),
  allowedWorkerTypes: text('allowed_worker_types'),
  specPath: text('spec_path'),
  artifactPlanPath: text('artifact_plan_path'),
  plannerArtifactsJson: text('planner_artifacts_json'),
  plannerReadinessVerdictJson: text('planner_readiness_verdict_json'),
  parentRunId: text('parent_run_id'),
  forkedFromMessageId: text('forked_from_message_id'),
  autoCommitMilestones: integer('auto_commit_milestones', { mode: 'boolean' }).notNull().default(false),
  pushOnCommit: integer('push_on_commit', { mode: 'boolean' }).notNull().default(false),
  gitBaselineJson: text('git_baseline_json'),
  gitWorkspaceJson: text('git_workspace_json'),
  completionCommitSha: text('completion_commit_sha'),
  status: text('status').notNull(), // 'running', 'done', 'failed'
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  memoryMetadataRevision: integer('memory_metadata_revision').notNull().default(0),
  lastMemoryConsolidationAt: integer('last_memory_consolidation_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(), // 'idle', 'working', 'stuck', 'cred-exhausted'
  cwd: text('cwd').notNull(),
  workerNumber: integer('worker_number'),
  workerRole: text('worker_role'),
  allocationKey: text('allocation_key'),
  title: text('title').notNull().default(''),
  initialPrompt: text('initial_prompt').notNull().default(''),
  outputLog: text('output_log').notNull().default(''),
  outputEntriesJson: text('output_entries_json').notNull().default(''),
  currentText: text('current_text').notNull().default(''),
  lastText: text('last_text').notNull().default(''),
  bridgeSessionId: text('bridge_session_id'),
  bridgeSessionMode: text('bridge_session_mode'),
  activeWorkStartedAt: integer('active_work_started_at', { mode: 'timestamp' }),
  activeWorkDurationMs: integer('active_work_duration_ms').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const processSessions = sqliteTable('process_sessions', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  cwd: text('cwd').notNull(),
  commandJson: text('command_json').notNull(),
  commandPreview: text('command_preview').notNull(),
  envPolicy: text('env_policy').notNull().default('minimal'),
  pid: integer('pid'),
  status: text('status').notNull(),
  exitCode: integer('exit_code'),
  signal: text('signal'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  exitedAt: integer('exited_at', { mode: 'timestamp' }),
  killEscalatedAt: integer('kill_escalated_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerCounters = sqliteTable('worker_counters', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  nextNumber: integer('next_number').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  role: text('role').notNull(), // 'user', 'supervisor', 'worker'
  kind: text('kind'),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  workerId: text('worker_id').references(() => workers.id),
  supersededAt: integer('superseded_at', { mode: 'timestamp' }),
  editedFromMessageId: text('edited_from_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const conversationReadMarkers = sqliteTable('conversation_read_markers', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  lastReadAt: integer('last_read_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const queuedConversationMessages = sqliteTable('queued_conversation_messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  targetWorkerId: text('target_worker_id').references(() => workers.id),
  action: text('action').notNull(),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  status: text('status').notNull(),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
});

export const recoveryIncidents = sqliteTable('recovery_incidents', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  queuedMessageId: text('queued_message_id').references(() => queuedConversationMessages.id),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  autoAttemptCount: integer('auto_attempt_count').notNull().default(0),
  lastError: text('last_error'),
  details: text('details'),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const supervisorScheduledWakes = sqliteTable('supervisor_scheduled_wakes', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  wakeAt: integer('wake_at', { mode: 'timestamp' }).notNull(),
  reason: text('reason').notNull(),
  source: text('source'),
  incidentId: text('incident_id').references(() => recoveryIncidents.id),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  type: text('type').notNull(), // 'subscription' | 'api'
  authRef: text('auth_ref').notNull(),
  capacity: integer('capacity'),
  resetSchedule: text('reset_schedule'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const creditEvents = sqliteTable('credit_events', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id).notNull(),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  eventType: text('event_type').notNull(), // 'exhausted' | 'switched' | 'wait'
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  label: text('label'),
  userAgent: text('user_agent'),
  authMethod: text('auth_method').notNull(),
  createdBySessionId: text('created_by_session_id'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const notificationSubscriptions = sqliteTable('notification_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  sessionId: text('session_id').references(() => authSessions.id),
  userAgent: text('user_agent'),
  failureCount: integer('failure_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
});

export const authPairTokens = sqliteTable('auth_pair_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  creatorSessionId: text('creator_session_id').notNull(),
  targetRunId: text('target_run_id'),
  deviceLabel: text('device_label'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  redeemedAt: integer('redeemed_at', { mode: 'timestamp' }),
  redeemedSessionId: text('redeemed_session_id'),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authEvents = sqliteTable('auth_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  pairTokenId: text('pair_token_id'),
  eventType: text('event_type').notNull(),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const planItems = sqliteTable('plan_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  phase: text('phase'),
  title: text('title').notNull(),
  status: text('status').notNull(), // 'pending', 'in_progress', 'blocked', 'done', 'failed'
  sourceLine: integer('source_line'),
  dependsOn: text('depends_on'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const clarifications = sqliteTable('clarifications', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status').notNull(), // 'pending', 'answered', 'dismissed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerAssignments = sqliteTable('worker_assignments', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id).notNull(),
  status: text('status').notNull(), // 'assigned', 'running', 'completed', 'failed', 'cancelled'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const executionEvents = sqliteTable('execution_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id),
  eventType: text('event_type').notNull(),
  // Legacy full-body column. After artifact migration, new writes
  // leave this null and large `details` live in the run-level
  // execution-events artifact stream addressed by artifact_seq.
  details: text('details'),
  // Append cursor pointing into the artifact stream. NULL = legacy row
  // whose body still lives in `details`.
  artifactSeq: integer('artifact_seq'),
  // SHA-256 hex of the canonical-serialized payload, for stable
  // dedupe/diagnostics without re-reading the artifact body.
  detailsHash: text('details_hash'),
  // Short preview (≤256 chars) safe to inline in hot snapshot lists.
  detailsPreview: text('details_preview'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const supervisorInterventions = sqliteTable('supervisor_interventions', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  interventionType: text('intervention_type').notNull(),
  // Legacy body columns. After artifact migration, new writes leave
  // these null and bodies live in the supervisor-interventions
  // artifact stream addressed by artifact_seq.
  prompt: text('prompt'),
  summary: text('summary'),
  artifactSeq: integer('artifact_seq'),
  promptHash: text('prompt_hash'),
  summaryPreview: text('summary_preview'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewRuns = sqliteTable('planning_review_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  status: text('status').notNull(),
  agentSelection: text('agent_selection').notNull(),
  resolvedWorkerType: text('resolved_worker_type'),
  roundsRequested: integer('rounds_requested').notNull(),
  roundsCompleted: integer('rounds_completed').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewRounds = sqliteTable('planning_review_rounds', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
  runId: text('run_id').notNull().references(() => runs.id),
  roundNumber: integer('round_number').notNull(),
  status: text('status').notNull(),
  workerId: text('worker_id'),
  resolvedWorkerType: text('resolved_worker_type'),
  selectionReason: text('selection_reason'),
  findingsSummary: text('findings_summary'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewFindings = sqliteTable('planning_review_findings', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
  roundId: text('round_id').notNull().references(() => planningReviewRounds.id),
  runId: text('run_id').notNull().references(() => runs.id),
  severity: text('severity').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  // Legacy body columns. After artifact migration, new writes leave
  // these null and bodies live in the planning-review-findings
  // artifact stream addressed by artifact_seq.
  details: text('details'),
  recommendation: text('recommendation'),
  artifactSeq: integer('artifact_seq'),
  detailsHash: text('details_hash'),
  recommendationPreview: text('recommendation_preview'),
  sourcePath: text('source_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * One row per (run_id, kind, owner_id) artifact stream. Records where
 * the file lives on disk, the append cursor, last verified state, and
 * error/compaction telemetry. owner_id is normalized via
 * ARTIFACT_STREAM_OWNER_NONE so SQLite UNIQUE actually catches dupes.
 */
export const artifactStreams = sqliteTable('artifact_streams', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  projectPath: text('project_path'),
  kind: text('kind').notNull(),
  ownerId: text('owner_id').notNull(),
  relativePath: text('relative_path').notNull(),
  latestSeq: integer('latest_seq').notNull().default(0),
  latestRecordId: text('latest_record_id'),
  status: text('status').notNull().default('active'),
  lastError: text('last_error'),
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
  compactedAt: integer('compacted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
