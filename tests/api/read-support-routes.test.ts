import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import {
  accounts,
  executionEvents,
  messages,
  plans,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  settings,
  supervisorScheduledWakes,
  workers,
} from "@/server/db/schema";

const { mockNotifyEventStreamSubscribers, mockResumeSupervisorRun } = vi.hoisted(() => ({
  mockNotifyEventStreamSubscribers: vi.fn(),
  mockResumeSupervisorRun: vi.fn().mockResolvedValue({ action: "resume_session" }),
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
}));

vi.mock("@/server/supervisor/resume", () => ({
  resumeSupervisorRun: mockResumeSupervisorRun,
}));

import { GET as getAccounts } from "@/app/api/accounts/route";
import { GET as browseDirectories } from "@/app/api/fs/route";
import { GET as getProjectFiles } from "@/app/api/fs/files/route";
import { GET as getMessages } from "@/app/api/messages/route";
import { GET as getPlans } from "@/app/api/plans/route";
import { GET as getProjectMemory, POST as updateProjectMemory } from "@/app/api/projects/memory/route";
import { POST as resumeRun } from "@/app/api/runs/[id]/resume/route";

const tempPaths: string[] = [];

function getRequest(url: string) {
  return new NextRequest(url, { method: "GET" });
}

function postRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

async function insertRun(projectPath?: string) {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: `vibes/ad-hoc/${planId}.md`,
    status: "running",
    createdAt: new Date("2026-05-12T10:00:00Z"),
    updatedAt: new Date("2026-05-12T10:00:00Z"),
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status: "running",
    projectPath,
    createdAt: new Date("2026-05-12T10:00:00Z"),
    updatedAt: new Date("2026-05-12T10:00:00Z"),
  });
  return { planId, runId };
}

describe("supporting API read routes", () => {
  beforeEach(async () => {
    mockNotifyEventStreamSubscribers.mockClear();
    mockResumeSupervisorRun.mockClear();
    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
    await db.delete(supervisorScheduledWakes);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(accounts);
    await db.delete(settings);
  });

  afterEach(() => {
    for (const tempPath of tempPaths.splice(0)) {
      fs.rmSync(tempPath, { recursive: true, force: true });
    }
  });

  it("returns accounts without requiring lower-level callers to touch the database", async () => {
    await db.insert(accounts).values({
      id: "account-1",
      provider: "openai",
      type: "api",
      authRef: "secret-ref",
      capacity: 100,
      resetSchedule: "daily",
      createdAt: new Date("2026-05-12T10:00:00Z"),
    });

    const response = await getAccounts(getRequest("http://localhost/api/accounts"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([expect.objectContaining({
      id: "account-1",
      provider: "openai",
      authRef: "secret-ref",
    })]);
  });

  it("returns plans in newest-first order at the route boundary", async () => {
    await db.insert(plans).values([
      {
        id: "old-plan",
        path: "vibes/ad-hoc/old.md",
        status: "done",
        createdAt: new Date("2026-05-12T09:00:00Z"),
        updatedAt: new Date("2026-05-12T09:00:00Z"),
      },
      {
        id: "new-plan",
        path: "vibes/ad-hoc/new.md",
        status: "running",
        createdAt: new Date("2026-05-12T10:00:00Z"),
        updatedAt: new Date("2026-05-12T10:00:00Z"),
      },
    ]);

    const response = await getPlans(getRequest("http://localhost/api/plans"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.map((plan: { id: string }) => plan.id)).toEqual(["new-plan", "old-plan"]);
  });

  it("serializes message timestamps and attachment metadata", async () => {
    const { runId } = await insertRun();
    await db.insert(messages).values({
      id: "message-1",
      runId,
      role: "user",
      kind: "checkpoint",
      content: "Here is the screenshot",
      attachmentsJson: JSON.stringify([{
        id: "attachment-1",
        kind: "image",
        name: "screen.png",
        mimeType: "image/png",
        size: 123,
        storagePath: "attachments/upload/screen.png",
      }]),
      createdAt: new Date("2026-05-12T10:15:00Z"),
    });

    const response = await getMessages(getRequest("http://localhost/api/messages"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual([expect.objectContaining({
      id: "message-1",
      createdAt: "2026-05-12T10:15:00.000Z",
      attachments: [expect.objectContaining({ name: "screen.png" })],
    })]);
  });

  it("clamps directory browsing requests that try to escape the allowed root", async () => {
    const response = await browseDirectories(getRequest("http://localhost/api/fs?path=/"));
    const payload = await response.json();
    const allowedRoot = path.resolve(process.cwd(), "..");

    expect(response.status).toBe(200);
    expect(payload.current).toBe(allowedRoot);
    expect(payload.parent).toBe(allowedRoot);
  });

  it("reads project files through the file route and returns route-shaped payloads", async () => {
    const root = fs.mkdtempSync(path.join(path.resolve(process.cwd(), ".."), "omni-route-files-"));
    tempPaths.push(root);
    fs.writeFileSync(path.join(root, "README.md"), "# Route file\n", "utf8");

    const listResponse = await getProjectFiles(getRequest(`http://localhost/api/fs/files?root=${encodeURIComponent(root)}`));
    const readResponse = await getProjectFiles(getRequest(
      `http://localhost/api/fs/files?root=${encodeURIComponent(root)}&file=${encodeURIComponent("README.md")}`,
    ));

    expect(listResponse.status).toBe(200);
    await expect(listResponse.json()).resolves.toMatchObject({
      root,
      files: ["README.md"],
    });
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      root,
      path: "README.md",
      content: "# Route file\n",
      truncated: false,
    });
  });

  it("updates project memory and bumps active run metadata after restart-readable persistence", async () => {
    const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omni-memory-route-"));
    tempPaths.push(projectPath);
    const { runId } = await insertRun(projectPath);

    const enableResponse = await updateProjectMemory(postRequest("http://localhost/api/projects/memory", {
      projectPath,
      enabled: true,
    }));
    const writeResponse = await updateProjectMemory(postRequest("http://localhost/api/projects/memory", {
      projectPath,
      path: "notes/session.md",
      content: "Remember the operator preference.\n",
    }));
    const readResponse = await getProjectMemory(getRequest(
      `http://localhost/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}&path=${encodeURIComponent("notes/session.md")}`,
    ));
    const run = await db.select().from(runs).where(eq(runs.id, runId)).get();

    expect(enableResponse.status).toBe(200);
    expect(writeResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({
      enabled: true,
      file: {
        path: "notes/session.md",
        content: "Remember the operator preference.\n",
        truncated: false,
      },
    });
    expect(run?.memoryMetadataRevision).toBe(2);
  });

  it("calls the durable resume boundary and notifies event stream subscribers", async () => {
    const runId = randomUUID();
    const response = await resumeRun(postRequest(`http://localhost/api/runs/${runId}/resume`, {}), {
      params: Promise.resolve({ id: runId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      runId,
      recovery: { action: "resume_session" },
    });
    expect(mockResumeSupervisorRun).toHaveBeenCalledWith(runId);
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });
});
