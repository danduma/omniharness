import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { getAppDataPath } from '@/server/app-root';

const dbPath = getAppDataPath('sqlite.db');
const sqlite = new Database(dbPath);
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
  status text NOT NULL,
  failed_at integer,
  last_error text,
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
  output_log text NOT NULL DEFAULT '',
  output_entries_json text NOT NULL DEFAULT '',
  current_text text NOT NULL DEFAULT '',
  last_text text NOT NULL DEFAULT '',
  bridge_session_id text,
  bridge_session_mode text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  role text NOT NULL,
  kind text,
  content text NOT NULL,
  worker_id text,
  superseded_at integer,
  edited_from_message_id text,
  created_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE no action ON DELETE no action
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

CREATE TABLE IF NOT EXISTS validation_runs (
  id text PRIMARY KEY NOT NULL,
  run_id text NOT NULL,
  plan_item_id text,
  status text NOT NULL,
  summary text,
  evidence text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id) ON UPDATE no action ON DELETE no action,
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
`);

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

if (!runColumnNames.has("failed_at")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN failed_at integer;");
}

if (!runColumnNames.has("last_error")) {
  sqlite.exec("ALTER TABLE runs ADD COLUMN last_error text;");
}

const messageColumns = sqlite.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string }>;
const messageColumnNames = new Set(messageColumns.map((column) => column.name));

const workerColumns = sqlite.prepare("PRAGMA table_info(workers)").all() as Array<{ name: string }>;
const workerColumnNames = new Set(workerColumns.map((column) => column.name));

if (!workerColumnNames.has("output_log")) {
  sqlite.exec("ALTER TABLE workers ADD COLUMN output_log text NOT NULL DEFAULT '';");
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

if (!messageColumnNames.has("kind")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN kind text;");
}

if (!messageColumnNames.has("superseded_at")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN superseded_at integer;");
}

if (!messageColumnNames.has("edited_from_message_id")) {
  sqlite.exec("ALTER TABLE messages ADD COLUMN edited_from_message_id text;");
}

export const db = drizzle(sqlite, { schema });
