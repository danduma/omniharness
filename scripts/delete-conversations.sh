#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${OMNIHARNESS_ROOT:-$(pwd)}"
DB_PATH="${OMNIHARNESS_DB_PATH:-$ROOT_DIR/sqlite.db}"
RUNTIME_URL="${OMNIHARNESS_BRIDGE_URL:-http://127.0.0.1:7800}"

ROOT_DIR="$ROOT_DIR" DB_PATH="$DB_PATH" RUNTIME_URL="$RUNTIME_URL" node --input-type=module <<'NODE'
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.env.ROOT_DIR);
const dbPath = path.resolve(process.env.DB_PATH);
const runtimeUrl = process.env.RUNTIME_URL;

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const tables = new Set(
  db.prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((row) => row.name),
);

const workerIds = db.prepare("select id from workers").all().map((row) => row.id);
const adHocPlanPaths = db
  .prepare("select path from plans where path like 'vibes/ad-hoc/%'")
  .all()
  .map((row) => row.path);
const runRowsForCleanup = db
  .prepare("select id, project_path from runs")
  .all();

async function cancelWorkers() {
  for (const id of workerIds) {
    try {
      await fetch(`${runtimeUrl}/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // best effort: keep cleanup going if the runtime is offline
    }
  }
}

function deleteConversationRows() {
  const tx = db.transaction(() => {
    db.prepare("delete from credit_events where worker_id in (select id from workers)").run();
    db.prepare("delete from messages where run_id in (select id from runs)").run();
    db.prepare("delete from clarifications where run_id in (select id from runs)").run();
    if (tables.has("validation_runs")) {
      db.prepare("delete from validation_runs where run_id in (select id from runs)").run();
    }
    db.prepare("delete from execution_events where run_id in (select id from runs)").run();
    if (tables.has("supervisor_interventions")) {
      db.prepare("delete from supervisor_interventions where run_id in (select id from runs)").run();
    }
    if (tables.has("supervisor_scheduled_wakes")) {
      db.prepare("delete from supervisor_scheduled_wakes where run_id in (select id from runs)").run();
    }
    if (tables.has("recovery_incidents")) {
      db.prepare("delete from recovery_incidents where run_id in (select id from runs)").run();
    }
    if (tables.has("queued_conversation_messages")) {
      db.prepare("delete from queued_conversation_messages where run_id in (select id from runs)").run();
    }
    if (tables.has("conversation_read_markers")) {
      db.prepare("delete from conversation_read_markers where run_id in (select id from runs)").run();
    }
    if (tables.has("worker_assignments")) {
      db.prepare("delete from worker_assignments where run_id in (select id from runs)").run();
    }
    if (tables.has("process_sessions")) {
      db.prepare("delete from process_sessions where run_id in (select id from runs)").run();
    }
    db.prepare("delete from workers where run_id in (select id from runs)").run();
    if (tables.has("worker_counters")) {
      db.prepare("delete from worker_counters where run_id in (select id from runs)").run();
    }
    db.prepare("delete from runs").run();

    if (tables.has("validation_runs")) {
      db.prepare("delete from validation_runs where plan_item_id in (select id from plan_items)").run();
    }
    db.prepare("delete from execution_events where plan_item_id in (select id from plan_items)").run();
    db.prepare("delete from plan_items").run();
    db.prepare("delete from plans").run();
  });

  tx();
}

function deleteAdHocPlanFiles() {
  for (const relPath of adHocPlanPaths) {
    const absPath = path.resolve(rootDir, relPath);
    if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { force: true });
    }
  }
}

function deleteArtifactFiles() {
  // Each run owns artifacts in two possible locations:
  //   - <projectPath>/.omniharness/run-data/<runId>/   (new, project-local)
  //   - <appData>/run-data/<runId>/                    (legacy global)
  // We attempt both and ignore ENOENT. The companion .zip is a legacy
  // archive format that may also be sitting next to the global root.
  const appDataRoot = process.env.OMNIHARNESS_APPDATA_DIR
    || path.join(process.env.HOME || "", "Library", "Application Support", "omniharness");
  const legacyGlobalRoot = path.join(appDataRoot, "run-data");

  for (const row of runRowsForCleanup) {
    const runId = row.id;
    const projectPath = row.project_path;
    const candidates = [];
    if (projectPath) {
      candidates.push(path.join(projectPath, ".omniharness", "run-data", runId));
    }
    candidates.push(path.join(legacyGlobalRoot, runId));
    for (const dir of candidates) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "ENOENT") {
          console.warn(`[delete-conversations] failed to remove ${dir}: ${error.message}`);
        }
      }
    }
    const zip = path.join(legacyGlobalRoot, `${runId}.zip`);
    try {
      fs.unlinkSync(zip);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`[delete-conversations] failed to remove ${zip}: ${error.message}`);
      }
    }
  }
}

async function main() {
  await cancelWorkers();
  deleteConversationRows();
  deleteAdHocPlanFiles();
  deleteArtifactFiles();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
