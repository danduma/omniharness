import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/server/db/schema";

const originalRoot = process.env.OMNIHARNESS_ROOT;
const tempRoots: string[] = [];

afterEach(() => {
  if (originalRoot === undefined) {
    delete process.env.OMNIHARNESS_ROOT;
  } else {
    process.env.OMNIHARNESS_ROOT = originalRoot;
  }
  for (const tempRoot of tempRoots.splice(0)) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe("db schema", () => {
  it("defines autonomous execution tables", () => {
    expect(schema).toHaveProperty("planItems");
    expect(schema).toHaveProperty("clarifications");
    expect(schema).toHaveProperty("executionEvents");
    expect(schema).toHaveProperty("workerAssignments");
    expect(schema).toHaveProperty("supervisorInterventions");
    expect(schema).toHaveProperty("queuedConversationMessages");
    expect(schema).toHaveProperty("recoveryIncidents");
    expect(schema).toHaveProperty("supervisorScheduledWakes");
  });

  it("persists durable worker terminal snapshots", () => {
    expect(schema).toHaveProperty("workerCounters");
    expect(schema.workers).toHaveProperty("workerNumber");
    expect(schema.workers).toHaveProperty("workerRole");
    expect(schema.workers).toHaveProperty("allocationKey");
    expect(schema.workers).toHaveProperty("outputEntriesJson");
    expect(schema.workers).toHaveProperty("currentText");
    expect(schema.workers).toHaveProperty("lastText");
  });

  it("persists structured message attachments", () => {
    expect(schema.messages).toHaveProperty("attachmentsJson");
  });

  it("persists conversation read markers server-side", () => {
    expect(schema).toHaveProperty("conversationReadMarkers");
    expect(schema.conversationReadMarkers).toHaveProperty("runId");
    expect(schema.conversationReadMarkers).toHaveProperty("lastReadAt");
  });

  it("persists mode-aware conversation metadata on runs", () => {
    expect(schema.runs).toHaveProperty("mode");
    expect(schema.runs).toHaveProperty("sessionType");
    expect(schema.runs).toHaveProperty("specPath");
    expect(schema.runs).toHaveProperty("artifactPlanPath");
    expect(schema.runs).toHaveProperty("plannerArtifactsJson");
    expect(schema.runs).toHaveProperty("archivedAt");
  });

  it("persists commit workflow metadata on runs", () => {
    expect(schema.runs).toHaveProperty("autoCommitMilestones");
    expect(schema.runs).toHaveProperty("pushOnCommit");
    expect(schema.runs).toHaveProperty("gitBaselineJson");
    expect(schema.runs).toHaveProperty("completionCommitSha");
  });

  it("defines planning review tables", () => {
    expect(schema).toHaveProperty("planningReviewRuns");
    expect(schema).toHaveProperty("planningReviewRounds");
    expect(schema).toHaveProperty("planningReviewFindings");
  });

  it("defines process session metadata", () => {
    expect(schema).toHaveProperty("processSessions");
    expect(schema.processSessions).toHaveProperty("commandJson");
    expect(schema.processSessions).toHaveProperty("commandPreview");
    expect(schema.processSessions).toHaveProperty("status");
  });

  it("backfills additive columns even when user_version is current", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-schema-"));
    tempRoots.push(tempRoot);
    process.env.OMNIHARNESS_ROOT = tempRoot;
    vi.resetModules();

    const client = createClient({ url: `file:${path.join(tempRoot, "sqlite.db")}` });
    await client.executeMultiple(`
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
  status text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  mode text NOT NULL DEFAULT 'implementation',
  session_type text NOT NULL DEFAULT 'omni'
);
PRAGMA user_version = 3;
`);

    const { dbReady } = await import("@/server/db");
    await dbReady;

    const columns = await client.execute("PRAGMA table_info(runs)");
    expect(columns.rows.map((row) => String((row as Record<string, unknown>).name))).toContain("phase");
  });
});
