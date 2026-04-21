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
  projectPath: text('project_path'),
  title: text('title'),
  preferredWorkerType: text('preferred_worker_type'),
  preferredWorkerModel: text('preferred_worker_model'),
  preferredWorkerEffort: text('preferred_worker_effort'),
  allowedWorkerTypes: text('allowed_worker_types'),
  parentRunId: text('parent_run_id'),
  forkedFromMessageId: text('forked_from_message_id'),
  status: text('status').notNull(), // 'running', 'done', 'failed'
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(), // 'idle', 'working', 'stuck', 'cred-exhausted'
  cwd: text('cwd').notNull(),
  outputLog: text('output_log').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  role: text('role').notNull(), // 'user', 'supervisor', 'worker'
  kind: text('kind'),
  content: text('content').notNull(),
  workerId: text('worker_id').references(() => workers.id),
  supersededAt: integer('superseded_at', { mode: 'timestamp' }),
  editedFromMessageId: text('edited_from_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
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

export const validationRuns = sqliteTable('validation_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  planItemId: text('plan_item_id').references(() => planItems.id),
  status: text('status').notNull(), // 'running', 'passed', 'failed'
  summary: text('summary'),
  evidence: text('evidence'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const executionEvents = sqliteTable('execution_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id),
  eventType: text('event_type').notNull(),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
