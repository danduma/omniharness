import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { getAppDataPath } from '@/server/app-root';

const dbPath = getAppDataPath('sqlite.db');
const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('busy_timeout = 15000');
sqlite.pragma('wal_autocheckpoint = 1000');
sqlite.pragma('cache_size = -20000');
sqlite.pragma('temp_store = MEMORY');
sqlite.pragma('foreign_keys = ON');

sqlite.exec(`
CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY NOT NULL,
  path text NOT NULL,
  status text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id text PRIMARY KEY NOT NULL,
  plan_id text NOT NULL,
  mode text NOT NULL DEFAULT 'implementation',
  project_path text,
  title text,
  preferred_worker_type text,
  preferred_worker_model text,
  preferred_worker_effort text,
  allowed_worker_types text,
  spec_path text,
  artifact_plan_path text,
  planner_artifacts_json text,
  parent_run_id text,
  forked_from_message_id text,
  auto_commit_milestones integer NOT NULL DEFAULT 0,
  push_on_commit integer NOT NULL DEFAULT 0,
  git_baseline_json text,
  git_workspace_json text,
  completion_commit_sha text,
  status text NOT NULL,
  failed_at integer,
  last_error text,
  archived_at integer,
  memory_metadata_revision integer NOT NULL DEFAULT 0,
  last_memory_consolidation_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS workers (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  cwd text NOT NULL,
  worker_number integer,
  title text NOT NULL DEFAULT '',
  initial_prompt text NOT NULL DEFAULT '',
  output_log text NOT NULL DEFAULT '',
  output_entries_json text NOT NULL DEFAULT '',
  current_text text NOT NULL DEFAULT '',
  last_text text NOT NULL DEFAULT '',
  bridge_session_id text,
  bridge_session_mode text,
  active_work_started_at integer,
  active_work_duration_ms integer NOT NULL DEFAULT 0,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS worker_counters (
  run_id text PRIMARY KEY NOT NULL,
  next_number integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  role text NOT NULL,
  kind text,
  content text NOT NULL,
  attachments_json text,
  worker_id text,
  superseded_at integer,
  edited_from_message_id text,
  created_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS queued_conversation_messages (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  target_worker_id text,
  action text NOT NULL,
  content text NOT NULL,
  attachments_json text,
  status text NOT NULL,
  last_error text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  delivered_at integer,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (target_worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS recovery_incidents (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  worker_id text,
  queued_message_id text,
  kind text NOT NULL,
  status text NOT NULL,
  auto_attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  details text,
  detected_at integer NOT NULL,
  updated_at integer NOT NULL,
  resolved_at integer,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (queued_message_id) REFERENCES queued_conversation_messages(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS supervisor_scheduled_wakes (
  run_id text PRIMARY KEY NOT NULL,
  wake_at integer NOT NULL,
  reason text NOT NULL,
  source text,
  incident_id text,
  details text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (incident_id) REFERENCES recovery_incidents(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY NOT NULL,
  provider text NOT NULL,
  type text NOT NULL,
  auth_ref text NOT NULL,
  capacity integer,
  reset_schedule text,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_events (
  id text PRIMARY KEY NOT NULL,
  account_id text NOT NULL,
  worker_id text NOT NULL,
  event_type text NOT NULL,
  details text,
  created_at integer NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY NOT NULL,
  value text NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL,
  label text,
  user_agent text,
  auth_method text NOT NULL,
  created_by_session_id text,
  last_seen_at integer NOT NULL,
  expires_at integer NOT NULL,
  absolute_expires_at integer NOT NULL,
  revoked_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id text PRIMARY KEY NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  session_id text,
  user_agent text,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  last_seen_at integer NOT NULL,
  revoked_at integer,
  FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS auth_pair_tokens (
  id text PRIMARY KEY NOT NULL,
  token_hash text NOT NULL,
  creator_session_id text NOT NULL,
  target_run_id text,
  device_label text,
  expires_at integer NOT NULL,
  redeemed_at integer,
  redeemed_session_id text,
  revoked_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_events (
  id text PRIMARY KEY NOT NULL,
  session_id text,
  pair_token_id text,
  event_type text NOT NULL,
  details text,
  created_at integer NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_items (
  id text PRIMARY KEY NOT NULL,
  plan_id text NOT NULL,
  phase text,
  title text NOT NULL,
  status text NOT NULL,
  source_line integer,
  depends_on text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (plan_id) REFERENCES plans(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS clarifications (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  question text NOT NULL,
  answer text,
  status text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS worker_assignments (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  worker_id text,
  plan_item_id text NOT NULL,
  status text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (plan_item_id) REFERENCES plan_items(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS execution_events (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  worker_id text,
  plan_item_id text,
  event_type text NOT NULL,
  details text,
  created_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (plan_item_id) REFERENCES plan_items(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS supervisor_interventions (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  worker_id text,
  intervention_type text NOT NULL,
  prompt text NOT NULL,
  summary text,
  created_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS planning_review_runs (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  status text NOT NULL,
  agent_selection text NOT NULL,
  resolved_worker_type text,
  rounds_requested integer NOT NULL,
  rounds_completed integer NOT NULL DEFAULT 0,
  started_at integer NOT NULL,
  completed_at integer,
  last_error text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS planning_review_rounds (
  id text PRIMARY KEY NOT NULL,
  review_run_id text NOT NULL,
  run_id text NOT NULL,
  round_number integer NOT NULL,
  status text NOT NULL,
  worker_id text,
  resolved_worker_type text,
  selection_reason text,
  findings_summary text,
  started_at integer,
  completed_at integer,
  last_error text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (review_run_id) REFERENCES planning_review_runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS planning_review_findings (
  id text PRIMARY KEY NOT NULL,
  review_run_id text NOT NULL,
  round_id text NOT NULL,
  run_id text NOT NULL,
  severity text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  details text NOT NULL,
  recommendation text NOT NULL,
  source_path text,
  created_at integer NOT NULL,
  FOREIGN KEY (review_run_id) REFERENCES planning_review_runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (round_id) REFERENCES planning_review_rounds(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);
`);

sqlite.exec(`
CREATE INDEX IF NOT EXISTS messages_run_created_idx ON messages(run_id, created_at);
CREATE INDEX IF NOT EXISTS workers_run_idx ON workers(run_id);
CREATE INDEX IF NOT EXISTS plan_items_plan_idx ON plan_items(plan_id);
CREATE INDEX IF NOT EXISTS clarifications_run_created_idx ON clarifications(run_id, created_at);
CREATE INDEX IF NOT EXISTS execution_events_run_created_idx ON execution_events(run_id, created_at);
CREATE INDEX IF NOT EXISTS supervisor_interventions_run_created_idx ON supervisor_interventions(run_id, created_at);
CREATE INDEX IF NOT EXISTS planning_review_runs_run_idx ON planning_review_runs(run_id);
CREATE INDEX IF NOT EXISTS planning_review_rounds_run_idx ON planning_review_rounds(run_id);
CREATE INDEX IF NOT EXISTS planning_review_findings_run_idx ON planning_review_findings(run_id);
CREATE INDEX IF NOT EXISTS queued_conversation_messages_run_status_created_idx ON queued_conversation_messages(run_id, status, created_at);
CREATE INDEX IF NOT EXISTS recovery_incidents_run_status_updated_idx ON recovery_incidents(run_id, status, updated_at);
CREATE INDEX IF NOT EXISTS supervisor_scheduled_wakes_wake_at_idx ON supervisor_scheduled_wakes(wake_at);
CREATE INDEX IF NOT EXISTS runs_created_idx ON runs(created_at);
CREATE INDEX IF NOT EXISTS plans_created_idx ON plans(created_at);
CREATE INDEX IF NOT EXISTS notification_subscriptions_revoked_idx ON notification_subscriptions(revoked_at);
`);

// Legacy cleanup: validation is now performed by supervisor tool use and checker workers,
// not persisted heuristic rows inferred from plan prose.
sqlite.exec("DROP TABLE IF EXISTS validation_runs;");

const runColumns = sqlite.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
const runColumnNames = new Set(runColumns.map((column) => column.name));

if (!runColumnNames.has("project_path")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN project_path text;");
}

if (!runColumnNames.has("mode")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN mode text NOT NULL DEFAULT 'implementation';");
}

if (!runColumnNames.has("title")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN title text;");
}

if (!runColumnNames.has("preferred_worker_type")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN preferred_worker_type text;");
}

if (!runColumnNames.has("preferred_worker_model")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN preferred_worker_model text;");
}

if (!runColumnNames.has("preferred_worker_effort")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN preferred_worker_effort text;");
}

if (!runColumnNames.has("allowed_worker_types")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN allowed_worker_types text;");
}

if (!runColumnNames.has("spec_path")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN spec_path text;");
}

if (!runColumnNames.has("artifact_plan_path")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN artifact_plan_path text;");
}

if (!runColumnNames.has("planner_artifacts_json")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN planner_artifacts_json text;");
}

if (!runColumnNames.has("parent_run_id")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN parent_run_id text;");
}

if (!runColumnNames.has("forked_from_message_id")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN forked_from_message_id text;");
}

if (!runColumnNames.has("auto_commit_milestones")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN auto_commit_milestones integer NOT NULL DEFAULT 0;");
}

if (!runColumnNames.has("push_on_commit")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN push_on_commit integer NOT NULL DEFAULT 0;");
}

if (!runColumnNames.has("git_baseline_json")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN git_baseline_json text;");
}

if (!runColumnNames.has("git_workspace_json")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN git_workspace_json text;");
}

if (!runColumnNames.has("completion_commit_sha")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN completion_commit_sha text;");
}

if (!runColumnNames.has("failed_at")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN failed_at integer;");
}

if (!runColumnNames.has("last_error")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN last_error text;");
}

if (!runColumnNames.has("archived_at")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN archived_at integer;");
}

if (!runColumnNames.has("memory_metadata_revision")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN memory_metadata_revision integer NOT NULL DEFAULT 0;");
}

if (!runColumnNames.has("last_memory_consolidation_at")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN last_memory_consolidation_at integer;");
}

const messageColumns = sqlite.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
const messageColumnNames = new Set(messageColumns.map((column) => column.name));

const workerColumns = sqlite.prepare("PRAGMA table_info(workers)").all() as Array<{ name: string }>;
const workerColumnNames = new Set(workerColumns.map((column) => column.name));

if (!workerColumnNames.has("output_log")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN output_log text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("worker_number")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN worker_number integer;");
}

if (!workerColumnNames.has("title")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN title text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("initial_prompt")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN initial_prompt text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("output_entries_json")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN output_entries_json text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("current_text")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN current_text text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("last_text")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN last_text text NOT NULL DEFAULT '';");
}

if (!workerColumnNames.has("bridge_session_id")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN bridge_session_id text;");
}

if (!workerColumnNames.has("bridge_session_mode")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN bridge_session_mode text;");
}

if (!workerColumnNames.has("active_work_started_at")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN active_work_started_at integer;");
}

if (!workerColumnNames.has("active_work_duration_ms")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN active_work_duration_ms integer NOT NULL DEFAULT 0;");
  sqlite.exec(`
    UPDATE workers
    SET active_work_duration_ms = MAX(0, updated_at - created_at) * 1000
    WHERE active_work_duration_ms = 0;
  `);
}

sqlite.exec(`
  UPDATE workers
  SET active_work_started_at = updated_at
  WHERE active_work_started_at IS NULL
    AND lower(substr(status, 1, instr(status || ':', ':') - 1)) = 'working';
`);

sqlite.exec(`
CREATE TRIGGER IF NOT EXISTS workers_work_timer_insert
AFTER INSERT ON workers
WHEN lower(substr(NEW.status, 1, instr(NEW.status || ':', ':') - 1)) = 'working'
BEGIN
  UPDATE workers
  SET active_work_started_at = COALESCE(NEW.active_work_started_at, NEW.created_at),
      active_work_duration_ms = COALESCE(NEW.active_work_duration_ms, 0)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS workers_work_timer_start
AFTER UPDATE OF status, updated_at ON workers
WHEN lower(substr(OLD.status, 1, instr(OLD.status || ':', ':') - 1)) != 'working'
  AND lower(substr(NEW.status, 1, instr(NEW.status || ':', ':') - 1)) = 'working'
BEGIN
  UPDATE workers
  SET active_work_started_at = NEW.updated_at,
      active_work_duration_ms = COALESCE(NEW.active_work_duration_ms, OLD.active_work_duration_ms, 0)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS workers_work_timer_stop
AFTER UPDATE OF status, updated_at ON workers
WHEN lower(substr(OLD.status, 1, instr(OLD.status || ':', ':') - 1)) = 'working'
  AND lower(substr(NEW.status, 1, instr(NEW.status || ':', ':') - 1)) != 'working'
BEGIN
  UPDATE workers
  SET active_work_started_at = NULL,
      active_work_duration_ms = COALESCE(OLD.active_work_duration_ms, 0)
        + (MAX(0, NEW.updated_at - COALESCE(OLD.active_work_started_at, OLD.updated_at, OLD.created_at, NEW.updated_at)) * 1000)
  WHERE id = NEW.id;
END;
`);

if (!messageColumnNames.has("kind")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN kind text;");
}

if (!messageColumnNames.has("superseded_at")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN superseded_at integer;");
}

if (!messageColumnNames.has("edited_from_message_id")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN edited_from_message_id text;");
}

if (!messageColumnNames.has("attachments_json")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN attachments_json text;");
}

export const db = drizzle(sqlite, { schema });
