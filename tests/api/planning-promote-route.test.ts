import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, messages } from "@/server/db/schema";

const { mockStartSupervisorRun } = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

import { POST } from "@/app/api/planning/[id]/promote/route";

describe("POST /api/planning/[id]/promote", () => {
  beforeEach(async () => {
    mockStartSupervisorRun.mockClear();
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("promotes a planning conversation into a fresh implementation run", async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "omni-promote-"));
    const sourcePlanId = randomUUID();
    const planningRunId = randomUUID();
    const implementationPlanPath = path.join(workspace, "docs/superpowers/plans/conversation-modes.md");

    fs.mkdirSync(path.dirname(implementationPlanPath), { recursive: true });
    fs.writeFileSync(implementationPlanPath, "## Phase 1\n- [ ] Add mode-aware launch flow\n");

    await db.insert(plans).values({
      id: sourcePlanId,
      path: "vibes/ad-hoc/planning-session.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: planningRunId,
      planId: sourcePlanId,
      mode: "planning",
      projectPath: workspace,
      artifactPlanPath: implementationPlanPath,
      plannerArtifactsJson: JSON.stringify({
        specPath: null,
        planPath: implementationPlanPath,
        candidates: [
          {
            path: implementationPlanPath,
            kind: "plan",
            exists: true,
            readiness: { ready: true, questions: [], gaps: [] },
          },
        ],
      }),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(messages).values([
      {
        id: randomUUID(),
        runId: planningRunId,
        role: "user",
        kind: "checkpoint",
        content: "Help me create the conversation modes plan",
        createdAt: new Date("2026-04-21T10:00:00Z"),
      },
      {
        id: randomUUID(),
        runId: planningRunId,
        role: "user",
        kind: "checkpoint",
        content: "The higher-level objective is to make mode switching trustworthy, not only to add controls.",
        createdAt: new Date("2026-04-21T10:01:00Z"),
      },
    ]);

    const request = new NextRequest(`http://localhost/api/planning/${planningRunId}/promote`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request, { params: Promise.resolve({ id: planningRunId }) });
    expect(response.status).toBe(200);

    const payload = await response.json();
    const promotedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const promotedPlan = await db.select().from(plans).where(eq(plans.id, promotedRun!.planId)).get();

    expect(promotedRun?.mode).toBe("implementation");
    expect(promotedRun?.projectPath).toBe(workspace);
    expect(promotedPlan?.path).toBe(implementationPlanPath);
    expect(promotedRun?.parentRunId).toBe(planningRunId);
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);

    const promotedMessages = await db.select().from(messages)
      .where(eq(messages.runId, payload.runId))
      .orderBy(messages.createdAt);
    expect(promotedMessages.map((message) => message.content)).toEqual([
      "Help me create the conversation modes plan",
      "The higher-level objective is to make mode switching trustworthy, not only to add controls.",
    ]);
  });

  it("rejects promotion when the selected plan is not ready", async () => {
    const sourcePlanId = randomUUID();
    const planningRunId = randomUUID();

    await db.insert(plans).values({
      id: sourcePlanId,
      path: "vibes/ad-hoc/planning-session.md",
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(runs).values({
      id: planningRunId,
      planId: sourcePlanId,
      mode: "planning",
      projectPath: "/workspace/app",
      plannerArtifactsJson: JSON.stringify({
        specPath: null,
        planPath: null,
        candidates: [
          {
            path: "/workspace/app/docs/superpowers/plans/draft.md",
            kind: "plan",
            exists: true,
            readiness: { ready: false, questions: ["What is the deliverable?"], gaps: ["No checklist items were found in the plan."] },
          },
        ],
      }),
      status: "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const request = new NextRequest(`http://localhost/api/planning/${planningRunId}/promote`, {
      method: "POST",
      body: JSON.stringify({ planPath: "/workspace/app/docs/superpowers/plans/draft.md" }),
    });

    const response = await POST(request, { params: Promise.resolve({ id: planningRunId }) });
    expect(response.status).toBe(400);
    expect(mockStartSupervisorRun).not.toHaveBeenCalled();
  });
});
