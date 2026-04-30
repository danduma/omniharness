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
    db.prepare("delete from validation_runs where run_id in (select id from runs)").run();
    db.prepare("delete from execution_events where run_id in (select id from runs)").run();
    if (tables.has("supervisor_interventions")) {
      db.prepare("delete from supervisor_interventions where run_id in (select id from runs)").run();
    }
    db.prepare("delete from workers where run_id in (select id from runs)").run();
    if (tables.has("worker_counters")) {
      db.prepare("delete from worker_counters where run_id in (select id from runs)").run();
    }
    db.prepare("delete from runs").run();

    db.prepare("delete from validation_runs where plan_item_id in (select id from plan_items)").run();
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

async function main() {
  await cancelWorkers();
  deleteConversationRows();
  deleteAdHocPlanFiles();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE
