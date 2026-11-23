import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const { mockNotifyEventStreamSubscribers, mockResumeRunManually } = vi.hoisted(() => ({
  mockNotifyEventStreamSubscribers: vi.fn(),
  mockResumeRunManually: vi.fn().mockResolvedValue({ action: "resume_session" }),
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: mockNotifyEventStreamSubscribers,
}));

vi.mock("@/server/runs/manual-resume", () => ({
  resumeRunManually: mockResumeRunManually,
}));

import {
  readAccountsRoute as getAccounts,
  readFilesystemRoute as browseDirectories,
  readMessagesRoute as getMessages,
  readProjectFilesRoute as getProjectFiles,
  runResumeRoute as resumeRun,
} from "@/../tests/helpers/runtime-routes";

const tempPaths: string[] = [];

function getRequest(url: string) {
  return new Request(url, { method: "GET" });
}

function postRequest(url: string, body: unknown) {
  return new Request(url, {
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
    mockResumeRunManually.mockClear();
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

  it("returns accounts without leaking credential references", async () => {
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
    const payload = await response.json();
    expect(payload).toEqual([expect.objectContaining({
      id: "account-1",
      provider: "openai",
      type: "api",
      capacity: 100,
      resetSchedule: "daily",
      createdAt: expect.any(String),
    })]);
    expect(JSON.stringify(payload)).not.toContain("secret-ref");
    expect(payload[0]).not.toHaveProperty("authRef");
    expect(payload[0]).not.toHaveProperty("auth_ref");
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
    expect(mockResumeRunManually).toHaveBeenCalledWith(runId);
    expect(mockNotifyEventStreamSubscribers).toHaveBeenCalledTimes(1);
  });
});
