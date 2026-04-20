import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { db } from "@/server/db";
import { plans, runs, messages } from "@/server/db/schema";

const mockRun = vi.fn().mockResolvedValue(undefined);
const mockSyncAccounts = vi.fn().mockResolvedValue(undefined);

vi.mock("@/server/supervisor", () => ({
  Supervisor: class MockSupervisor {
    run = mockRun;
  },
}));

vi.mock("@/server/credits", () => ({
  CreditManager: class MockCreditManager {
    syncAccounts = mockSyncAccounts;
  },
}));

import { POST } from "@/app/api/supervisor/route";

describe("POST /api/supervisor", () => {
  const createdFiles: string[] = [];

  beforeEach(() => {
    mockRun.mockClear();
    mockSyncAccounts.mockClear();
  });

  afterEach(() => {
    for (const filePath of createdFiles.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
      }
    }

    const adHocDir = path.resolve(process.cwd(), "vibes", "ad-hoc");
    if (fs.existsSync(adHocDir) && fs.readdirSync(adHocDir).length === 0) {
      fs.rmdirSync(adHocDir);
    }
  });

  it("accepts arbitrary command text by materializing an ad hoc plan", async () => {
    const command = "add a new smoke test for the login flow";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({ command }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedPlan = await db.select().from(plans).where(eq(plans.id, payload.planId)).get();
    const insertedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const insertedMessage = await db.select().from(messages).where(eq(messages.runId, payload.runId)).get();

    expect(insertedPlan?.path).toMatch(/^vibes\/ad-hoc\/.+\.md$/);
    expect(insertedRun?.planId).toBe(payload.planId);
    expect(insertedMessage?.content).toBe(command);
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();

    const adHocPlanPath = path.resolve(process.cwd(), insertedPlan!.path);
    createdFiles.push(adHocPlanPath);
    expect(fs.existsSync(adHocPlanPath)).toBe(true);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain(command);
  });

  it("treats a bare path string as text instead of resolving it as a plan path", async () => {
    const command = "vibes/test-plan.md";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({ command }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedPlan = await db.select().from(plans).where(eq(plans.id, payload.planId)).get();
    const insertedMessage = await db.select().from(messages).where(eq(messages.runId, payload.runId)).get();

    expect(insertedPlan?.path).toMatch(/^vibes\/ad-hoc\/.+\.md$/);
    expect(insertedMessage?.content).toBe(command);
    const adHocPlanPath = path.resolve(process.cwd(), insertedPlan!.path);
    createdFiles.push(adHocPlanPath);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain(command);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain("- [ ] vibes/test-plan.md");
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();
  });

  it("accepts optional attachment metadata alongside text input", async () => {
    const command = "inspect the attached screenshot and notes";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({
        command,
        attachments: [
          { kind: "image", name: "bug.png", path: "/tmp/bug.png" },
          { kind: "file", name: "notes.md", path: "/tmp/notes.md" },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedPlan = await db.select().from(plans).where(eq(plans.id, payload.planId)).get();
    const insertedMessage = await db.select().from(messages).where(eq(messages.runId, payload.runId)).get();
    const adHocPlanPath = path.resolve(process.cwd(), insertedPlan!.path);

    createdFiles.push(adHocPlanPath);
    expect(insertedPlan?.path).toMatch(/^vibes\/ad-hoc\/.+\.md$/);
    expect(insertedMessage?.content).toBe(command);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain(command);
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockRun).toHaveBeenCalledOnce();
  });
});
