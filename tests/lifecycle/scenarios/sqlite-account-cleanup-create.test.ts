/**
 * Regression for the 2026-08-16 conversation-create failure.
 *
 * Worker-id allocation used a DML RETURNING statement immediately before
 * account migration ran a batch of more DML RETURNING statements. With the
 * local libSQL driver, that sequence could leave statements active at commit,
 * roll back the parent run, and make the first message fail its run_id FK.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  messages,
  plans,
  processSessions,
  runs,
  settings,
  workerCounters,
  workers,
} from "@/server/db/schema";
import { deletedAccountSettingKey } from "@/server/accounts/migration";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { eventsRouteModule as eventsRoute } from "@/../tests/helpers/runtime-routes";
import { conversationsRouteModule as conversationsRoute } from "@/../tests/helpers/runtime-routes";
import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  askAgent: vi.fn().mockResolvedValue({ response: "ok", state: "idle" }),
  getAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/workspaces", async () => {
  const actual = await vi.importActual<typeof import("@/server/git/workspaces")>(
    "@/server/git/workspaces",
  );
  return { ...actual, createBranchWorktree: vi.fn() };
});

vi.mock("@/server/git/auto-commit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/git/auto-commit")>();
  return {
    ...actual,
    autoCommitMilestone: vi.fn(() => ({ status: "skipped", reason: "disabled" })),
    captureGitBaseline: vi.fn(() => null),
  };
});

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(messages);
  await db.delete(processSessions);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  await db.delete(accounts);
  await db.delete(settings);
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(816, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle — SQLite account cleanup during conversation creation", () => {
  it("persists the run, worker, and first message while removing a tombstoned account", async () => {
    const accountId = "lifecycle-deleted-account";
    const now = new Date("2026-08-16T13:28:44.000Z");
    await db.insert(accounts).values({
      id: accountId,
      cliType: "codex",
      provider: "openai",
      type: "api",
      label: accountId,
      authMode: "legacy_ref",
      authRef: "OPENAI_API_KEY",
      enabled: true,
      createdAt: now,
    });
    await db.insert(settings).values({
      key: deletedAccountSettingKey(accountId),
      value: accountId,
      updatedAt: now,
    });

    await client.bootstrapSnapshot();
    await client.subscribe({});
    const response = await client.fetch("/api/conversations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: "direct", command: "keep the first message" }),
    });

    expect(response.status).toBe(200);
    const created = await response.json() as { runId: string; message: { id: string } };
    expect(await db.select().from(runs).where(eq(runs.id, created.runId)).get()).toBeDefined();
    expect(await db.select().from(workers).where(eq(workers.runId, created.runId)).get()).toBeDefined();
    expect(await db.select().from(messages).where(eq(messages.id, created.message.id)).get()).toMatchObject({
      runId: created.runId,
      content: "keep the first message",
    });
    expect(await db.select().from(accounts).where(eq(accounts.id, accountId)).get()).toBeUndefined();
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).not.toContainEqual(
      expect.objectContaining({ kind: "account.delete_failed", accountId }),
    );
  });
});
