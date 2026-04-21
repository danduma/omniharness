import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import fs from "fs";
import { db } from "@/server/db";
import { getAppDataPath } from "@/server/app-root";
import { plans, runs, messages } from "@/server/db/schema";
import { persistRunFailure } from "@/server/runs/failures";

const {
  mockStartSupervisorRun,
  mockSyncAccounts,
  mockQueueConversationTitleGeneration,
} = vi.hoisted(() => ({
  mockStartSupervisorRun: vi.fn(),
  mockSyncAccounts: vi.fn().mockResolvedValue(undefined),
  mockQueueConversationTitleGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: mockStartSupervisorRun,
}));

vi.mock("@/server/credits", () => ({
  CreditManager: class MockCreditManager {
    syncAccounts = mockSyncAccounts;
  },
}));

vi.mock("@/server/conversation-title", () => ({
  queueConversationTitleGeneration: mockQueueConversationTitleGeneration,
}));

import { POST } from "@/app/api/supervisor/route";

describe("POST /api/supervisor", () => {
  const createdFiles: string[] = [];

  beforeEach(() => {
    mockStartSupervisorRun.mockClear();
    mockSyncAccounts.mockClear();
    mockQueueConversationTitleGeneration.mockClear();
  });

  afterEach(() => {
    for (const filePath of createdFiles.splice(0)) {
      if (fs.existsSync(filePath)) {
        fs.rmSync(filePath);
      }
    }

    const adHocDir = getAppDataPath("vibes", "ad-hoc");
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
    expect(insertedRun?.title).toBe("New conversation");
    expect(insertedRun?.projectPath).toBeNull();
    expect(insertedMessage?.content).toBe(command);
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
    expect(mockQueueConversationTitleGeneration).toHaveBeenCalledWith({ runId: payload.runId, command });

    const adHocPlanPath = getAppDataPath(insertedPlan!.path);
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
    const adHocPlanPath = getAppDataPath(insertedPlan!.path);
    createdFiles.push(adHocPlanPath);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain(command);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain("Original command:");
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
  });

  it("stores the selected project path on the run for folder grouping", async () => {
    const command = "fix the search layout";
    const projectPath = "/Users/masterman/NLP/wikinuxt";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({ command, projectPath }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(insertedRun?.projectPath).toBe(projectPath);
    expect(insertedRun?.title).toBe("New conversation");
    expect(mockQueueConversationTitleGeneration).toHaveBeenCalledWith({ runId: payload.runId, command });
  });

  it("persists preferred and allowed worker types on the run", async () => {
    const command = "fix the search layout";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({
        command,
        preferredWorkerType: "Codex",
        allowedWorkerTypes: ["codex", "opencode"],
        preferredWorkerModel: "openai/gpt-5.4",
        preferredWorkerEffort: "high",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(insertedRun?.preferredWorkerType).toBe("codex");
    expect(insertedRun?.allowedWorkerTypes).toBe(JSON.stringify(["codex", "opencode"]));
    expect(insertedRun?.preferredWorkerModel).toBe("openai/gpt-5.4");
    expect(insertedRun?.preferredWorkerEffort).toBe("high");
  });

  it("supports auto worker selection by persisting only the allowed worker pool", async () => {
    const command = "inspect the repo";
    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({
        command,
        preferredWorkerType: null,
        allowedWorkerTypes: ["codex", "opencode"],
        preferredWorkerEffort: "high",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    const insertedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();

    expect(insertedRun?.preferredWorkerType).toBeNull();
    expect(insertedRun?.allowedWorkerTypes).toBe(JSON.stringify(["codex", "opencode"]));
    expect(insertedRun?.preferredWorkerEffort).toBe("high");
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
    const adHocPlanPath = getAppDataPath(insertedPlan!.path);

    createdFiles.push(adHocPlanPath);
    expect(insertedPlan?.path).toMatch(/^vibes\/ad-hoc\/.+\.md$/);
    expect(insertedMessage?.content).toBe(command);
    expect(fs.readFileSync(adHocPlanPath, "utf-8")).toContain(command);
    expect(mockSyncAccounts).toHaveBeenCalledOnce();
    expect(mockStartSupervisorRun).toHaveBeenCalledWith(payload.runId);
  });

  it("persists a visible failure when the supervisor crashes after launch", async () => {
    mockStartSupervisorRun.mockImplementationOnce((runId: string) => {
      setTimeout(() => {
        void persistRunFailure(runId, new Error("API key not valid"));
      }, 0);
    });

    const request = new NextRequest("http://localhost/api/supervisor", {
      method: "POST",
      body: JSON.stringify({ command: "retry the failing run" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const payload = await response.json();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const insertedRun = await db.select().from(runs).where(eq(runs.id, payload.runId)).get();
    const runMessages = await db.select().from(messages).where(eq(messages.runId, payload.runId));

    expect(insertedRun?.status).toBe("failed");
    expect(runMessages.some((message) => message.content.includes("API key not valid"))).toBe(true);
  });
});
