import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { executionEvents, messages, plans, runs, workerCounters } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { buildSupervisorTurnContext } from "@/server/supervisor/context";

vi.mock("@/server/bridge-client", () => ({
  getAgent: vi.fn(),
}));

describe("buildSupervisorTurnContext", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(executionEvents);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("includes the stored plan artifact with the original user objective", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const planPath = "vibes/ad-hoc/objective-plan.md";
    const planContent = "# Plan\n\n## Objective\n\nMake completion objective-gated.\n\n- [ ] Update supervisor";
    const absolutePlanPath = getAppDataPath(planPath);
    fs.mkdirSync(path.dirname(absolutePlanPath), { recursive: true });
    fs.writeFileSync(absolutePlanPath, planContent, "utf8");

    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      projectPath: "/workspace/app",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Ensure completion is gated by the original intent.",
      createdAt: new Date(),
    });

    const context = await buildSupervisorTurnContext(runId);

    expect(context.goal).toBe("Ensure completion is gated by the original intent.");
    expect(context.planPath).toBe(planPath);
    expect(context.planContent).toBe(planContent);
  });

  it("includes supervisor-authored user messages in the next conversation history", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/objective-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      projectPath: "/workspace/app",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(messages).values([
      {
        id: randomUUID(),
        runId,
        role: "user",
        kind: "checkpoint",
        content: "Keep the fork easy to sync.",
        createdAt: now,
      },
      {
        id: randomUUID(),
        runId,
        role: "supervisor",
        kind: "update",
        content: "I delivered the sync-safety constraint and will keep watching for upstream-sensitive edits.",
        createdAt: new Date(now.getTime() + 1_000),
      },
    ]);

    const context = await buildSupervisorTurnContext(runId);

    expect(context.conversationTurns).toEqual([
      expect.objectContaining({
        role: "user",
        kind: "checkpoint",
        content: "Keep the fork easy to sync.",
      }),
      expect.objectContaining({
        role: "supervisor",
        kind: "update",
        content: "I delivered the sync-safety constraint and will keep watching for upstream-sensitive edits.",
      }),
    ]);
  });

  it("includes files read by the supervisor as reusable context", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/objective-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      projectPath: "/workspace/app",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId: null,
      planItemId: null,
      eventType: "supervisor_file_read",
      details: JSON.stringify({
        summary: "Read docs/spec.md for preflight intent extraction.",
        path: "docs/spec.md",
        content: "# Spec\n\nThe goal is to stop asking users to paste readable files.",
        truncated: false,
      }),
      createdAt: now,
    });

    const context = await buildSupervisorTurnContext(runId);

    expect(context.readFiles).toEqual([
      {
        path: "docs/spec.md",
        content: "# Spec\n\nThe goal is to stop asking users to paste readable files.",
        truncated: false,
      },
    ]);
  });

  it("includes repository inspection output as reusable context", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/objective-plan.md",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      projectPath: "/workspace/app",
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId,
      workerId: null,
      planItemId: null,
      eventType: "supervisor_repo_inspected",
      details: JSON.stringify({
        summary: "Inspected repository with sed -n 1,20p docs/spec.md.",
        command: "sed",
        args: ["-n", "1,20p", "docs/spec.md"],
        cwd: "/workspace/app",
        exitCode: 0,
        output: "# Spec\n\nAcceptance criteria are here.",
      }),
      createdAt: now,
    });

    const context = await buildSupervisorTurnContext(runId);

    expect(context.repoInspections).toEqual([
      {
        command: "sed",
        args: ["-n", "1,20p", "docs/spec.md"],
        cwd: "/workspace/app",
        exitCode: 0,
        output: "# Spec\n\nAcceptance criteria are here.",
      },
    ]);
  });
});
