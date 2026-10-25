import { createClient } from "@libsql/client";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentRecord } from "@/server/bridge-client";
import { initializeDatabaseSchema } from "@/server/db";
import { createGoalControlService } from "@/server/runs/goal-control";
import { readInitialGoalObjective, startInitialGoal } from "@/server/conversations/initial-goal";

const tempRoots: string[] = [];
const clients: ReturnType<typeof createClient>[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  for (const tempRoot of tempRoots.splice(0)) fs.rmSync(tempRoot, { recursive: true, force: true });
});

async function databaseWithRun() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omni-initial-goal-"));
  tempRoots.push(tempRoot);
  const client = createClient({ url: `file:${path.join(tempRoot, "sqlite.db")}` });
  clients.push(client);
  await initializeDatabaseSchema(client);
  const now = Date.now();
  await client.batch([
    { sql: "INSERT INTO plans (id, path, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: ["plan-1", "/tmp/plan.md", "running", now, now] },
    { sql: "INSERT INTO runs (id, plan_id, status, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: ["run-1", "plan-1", "running", "direct", now, now] },
    { sql: "INSERT INTO workers (id, run_id, type, status, cwd, bridge_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args: ["run-1-worker-1", "run-1", "claude", "starting", "/tmp", "session-1", now, now] },
  ], "write");
  return createGoalControlService(client);
}

function agent(advertisedCommands: string[] | undefined): AgentRecord {
  return {
    name: "run-1-worker-1",
    type: "claude",
    cwd: "/tmp",
    state: "idle",
    sessionId: "session-1",
    advertisedCommands,
    lastText: "",
    currentText: "",
    stderrBuffer: [],
    stopReason: null,
  } as unknown as AgentRecord;
}

const noPublish = { refreshDerivedPlan: async () => null, publish: async () => null, sleep: async () => {} };

describe("readInitialGoalObjective", () => {
  it("reads the objective of an opening /goal command", () => {
    expect(readInitialGoalObjective("/goal fully implement the plan", false)).toBe("fully implement the plan");
  });

  it("ignores ordinary messages, empty goals and messages with attachments", () => {
    expect(readInitialGoalObjective("please set a /goal for me", false)).toBeNull();
    expect(readInitialGoalObjective("/goal", false)).toBeNull();
    expect(readInitialGoalObjective("/goal ship it", true)).toBeNull();
  });
});

describe("startInitialGoal", () => {
  it("records the goal, leases it to the new worker and returns the /goal prompt", async () => {
    const control = await databaseWithRun();
    const result = await startInitialGoal(
      { runId: "run-1", workerId: "run-1-worker-1", agent: agent(["goal", "compact"]), objective: "ship it" },
      { control, getAgent: vi.fn(), ...noPublish },
    );

    expect(result).toEqual({ kind: "started", prompt: "/goal ship it" });
    const goal = await control.getGoal("run-1");
    expect(goal).toMatchObject({
      objective: "ship it",
      workerId: "run-1-worker-1",
      acpSessionId: "session-1",
      capabilities: { set: true, fallbackMethod: "/goal" },
    });
    // The opening turn is the dispatch; recovery must not send it again.
    expect(await control.isControlSettled(goal!)).toBe(true);
  });

  it("waits for a fresh session to advertise its commands", async () => {
    const control = await databaseWithRun();
    const getAgent = vi.fn()
      .mockResolvedValueOnce(agent([]))
      .mockResolvedValueOnce(agent(["goal"]));
    const result = await startInitialGoal(
      { runId: "run-1", workerId: "run-1-worker-1", agent: agent(undefined), objective: "ship it" },
      { control, getAgent, ...noPublish },
    );

    expect(result.kind).toBe("started");
    expect(getAgent).toHaveBeenCalledTimes(2);
  });

  it("records nothing when the agent does not offer /goal", async () => {
    const control = await databaseWithRun();
    const result = await startInitialGoal(
      { runId: "run-1", workerId: "run-1-worker-1", agent: agent(["compact"]), objective: "ship it" },
      { control, getAgent: vi.fn(), ...noPublish },
    );

    expect(result).toEqual({ kind: "skipped", reason: "fallback_not_advertised_for_set" });
    expect(await control.getGoal("run-1")).toBeNull();
  });
});
