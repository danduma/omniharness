import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import Database from "better-sqlite3";

function setupTempDb(dbPath: string, rootDir: string) {
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE plans (
      id text PRIMARY KEY NOT NULL,
      path text NOT NULL,
      status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );

    CREATE TABLE runs (
      id text PRIMARY KEY NOT NULL,
      plan_id text NOT NULL,
      project_path text,
      title text,
      status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE workers (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      type text NOT NULL,
      status text NOT NULL,
      cwd text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE messages (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      role text NOT NULL,
      content text NOT NULL,
      worker_id text,
      created_at integer NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE clarifications (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      question text NOT NULL,
      answer text,
      status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id)
    );

    CREATE TABLE plan_items (
      id text PRIMARY KEY NOT NULL,
      plan_id text NOT NULL,
      title text NOT NULL,
      status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    );

    CREATE TABLE validation_runs (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      plan_item_id text,
      status text NOT NULL,
      created_at integer NOT NULL,
      updated_at integer NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (plan_item_id) REFERENCES plan_items(id)
    );

    CREATE TABLE execution_events (
      id text PRIMARY KEY NOT NULL,
      run_id text NOT NULL,
      worker_id text,
      plan_item_id text,
      event_type text NOT NULL,
      created_at integer NOT NULL,
      FOREIGN KEY (run_id) REFERENCES runs(id),
      FOREIGN KEY (worker_id) REFERENCES workers(id),
      FOREIGN KEY (plan_item_id) REFERENCES plan_items(id)
    );

    CREATE TABLE credit_events (
      id text PRIMARY KEY NOT NULL,
      account_id text NOT NULL,
      worker_id text NOT NULL,
      event_type text NOT NULL,
      created_at integer NOT NULL,
      FOREIGN KEY (worker_id) REFERENCES workers(id)
    );

    CREATE TABLE accounts (
      id text PRIMARY KEY NOT NULL,
      provider text NOT NULL
    );

    CREATE TABLE settings (
      key text PRIMARY KEY NOT NULL,
      value text NOT NULL,
      updated_at integer NOT NULL
    );
  `);

  const now = Date.now();
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = randomUUID();
  const planItemId = randomUUID();
  const adHocPath = path.join("vibes", "ad-hoc", `${randomUUID()}.md`);
  const adHocAbsPath = path.join(rootDir, adHocPath);

  fs.mkdirSync(path.dirname(adHocAbsPath), { recursive: true });
  fs.writeFileSync(adHocAbsPath, "# temp plan\n");

  db.prepare("insert into plans (id, path, status, created_at, updated_at) values (?, ?, ?, ?, ?)")
    .run(planId, adHocPath, "running", now, now);
  db.prepare("insert into runs (id, plan_id, project_path, title, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(runId, planId, rootDir, "Test conversation", "running", now, now);
  db.prepare("insert into workers (id, run_id, type, status, cwd, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(workerId, runId, "codex", "idle", rootDir, now, now);
  db.prepare("insert into messages (id, run_id, role, content, worker_id, created_at) values (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), runId, "user", "hello", workerId, now);
  db.prepare("insert into clarifications (id, run_id, question, answer, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), runId, "question", null, "pending", now, now);
  db.prepare("insert into plan_items (id, plan_id, title, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)")
    .run(planItemId, planId, "task", "pending", now, now);
  db.prepare("insert into validation_runs (id, run_id, plan_item_id, status, created_at, updated_at) values (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), runId, planItemId, "failed", now, now);
  db.prepare("insert into execution_events (id, run_id, worker_id, plan_item_id, event_type, created_at) values (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), runId, workerId, planItemId, "spawned", now);
  db.prepare("insert into accounts (id, provider) values (?, ?)")
    .run(randomUUID(), "openai");
  db.prepare("insert into settings (key, value, updated_at) values (?, ?, ?)")
    .run("theme", "dark", now);
  db.prepare("insert into credit_events (id, account_id, worker_id, event_type, created_at) values (?, ?, ?, ?, ?)")
    .run(randomUUID(), "account-1", workerId, "switched", now);

  return { db, adHocAbsPath };
}

describe("delete-conversations.sh", () => {
  it("removes conversations and associated ad-hoc plan files without touching settings or accounts", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "delete-conversations-"));
    const dbPath = path.join(rootDir, "sqlite.db");
    const { db, adHocAbsPath } = setupTempDb(dbPath, rootDir);

    expect(() =>
      execFileSync("bash", [path.join(process.cwd(), "scripts", "delete-conversations.sh")], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          OMNIHARNESS_DB_PATH: dbPath,
          OMNIHARNESS_ROOT: rootDir,
          OMNIHARNESS_BRIDGE_URL: "http://127.0.0.1:1",
        },
        stdio: "pipe",
      }),
    ).not.toThrow();

    const count = (table: string) => (
      db.prepare(`select count(*) as count from ${table}`).get() as { count: number }
    ).count;

    expect(count("plans")).toBe(0);
    expect(count("runs")).toBe(0);
    expect(count("messages")).toBe(0);
    expect(count("workers")).toBe(0);
    expect(count("clarifications")).toBe(0);
    expect(count("plan_items")).toBe(0);
    expect(count("validation_runs")).toBe(0);
    expect(count("execution_events")).toBe(0);
    expect(count("credit_events")).toBe(0);
    expect(count("accounts")).toBe(1);
    expect(count("settings")).toBe(1);
    expect(fs.existsSync(adHocAbsPath)).toBe(false);
  });
});
