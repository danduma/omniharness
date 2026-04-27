import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { messages, plans, runs } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { buildSupervisorTurnContext } from "@/server/supervisor/context";

vi.mock("@/server/bridge-client", () => ({
  getAgent: vi.fn(),
}));

describe("buildSupervisorTurnContext", () => {
  beforeEach(async () => {
    await db.delete(messages);
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
});
