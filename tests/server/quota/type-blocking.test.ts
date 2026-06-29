import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  accounts,
  executionEvents,
  plans,
  recoveryIncidents,
  runs,
  supervisorScheduledWakes,
  workerCredentialAllocations,
  workers,
} from "@/server/db/schema";
import { isWorkerTypeQuotaBlocked, quotaBlockedTypes } from "@/server/quota/type-blocking";

const now = new Date("2026-05-16T10:00:00.000Z");

async function insertRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: "vibes/ad-hoc/type-blocking.md",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "implementation",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  return runId;
}

async function insertWorker(runId: string, type: string, status: string) {
  const workerId = `${runId}-${type}-${randomUUID().slice(0, 6)}`;
  await db.insert(workers).values({
    id: workerId,
    runId,
    type,
    status,
    cwd: "/tmp",
    workerNumber: 1,
    title: "Worker",
    initialPrompt: "",
    outputLog: "",
    outputEntriesJson: "",
    currentText: "",
    lastText: "",
    createdAt: now,
    updatedAt: now,
  });
  return workerId;
}

async function insertIncident(runId: string, workerId: string, status: string, resumeAt: Date | null) {
  const id = randomUUID();
  await db.insert(recoveryIncidents).values({
    id,
    runId,
    workerId,
    queuedMessageId: null,
    kind: "quota_exhausted",
    status,
    autoAttemptCount: 0,
    lastError: null,
    details: JSON.stringify({ resumeAt: resumeAt?.toISOString() ?? null }),
    detectedAt: now,
    updatedAt: now,
    resolvedAt: null,
  });
  return id;
}

async function insertAccount(type: string) {
  const id = `account-${randomUUID()}`;
  await db.insert(accounts).values({
    id,
    cliType: type,
    provider: type === "claude" ? "anthropic" : "openai",
    type: "subscription",
    label: id,
    authMode: "local_session",
    authRef: "local-default",
    enabled: true,
    priority: 0,
    status: "healthy",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

async function insertAllocation(runId: string, workerId: string, workerType: string, accountId: string) {
  await db.insert(workerCredentialAllocations).values({
    id: randomUUID(),
    runId,
    workerId,
    workerType,
    accountId,
    strategy: "manual",
    selectionReason: "test",
    explicit: true,
    createdAt: now,
    updatedAt: now,
  });
}

describe("isWorkerTypeQuotaBlocked", () => {
  beforeEach(async () => {
    await db.delete(supervisorScheduledWakes);
    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
    await db.delete(workerCredentialAllocations);
    await db.delete(workers);
    await db.delete(accounts);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("returns true when a worker of the type is cred-exhausted with future resumeAt", async () => {
    const runId = await insertRun();
    const workerId = await insertWorker(runId, "codex", "cred-exhausted");
    await insertIncident(runId, workerId, "open", new Date(now.getTime() + 60_000));
    expect(await isWorkerTypeQuotaBlocked("codex", { now })).toBe(true);
  });

  it("returns true when an open quota_exhausted incident exists with future resumeAt", async () => {
    const runId = await insertRun();
    const workerId = await insertWorker(runId, "claude", "working");
    await insertIncident(runId, workerId, "open", new Date(now.getTime() + 30_000));
    expect(await isWorkerTypeQuotaBlocked("claude", { now })).toBe(true);
  });

  it("returns false when incident resumeAt is in the past", async () => {
    const runId = await insertRun();
    const workerId = await insertWorker(runId, "codex", "cred-exhausted");
    await insertIncident(runId, workerId, "open", new Date(now.getTime() - 60_000));
    expect(await isWorkerTypeQuotaBlocked("codex", { now })).toBe(false);
  });

  it("returns false when there are no exhausted workers or incidents", async () => {
    const runId = await insertRun();
    await insertWorker(runId, "claude", "working");
    expect(await isWorkerTypeQuotaBlocked("claude", { now })).toBe(false);
  });

  it("returns false for a type that has no workers at all", async () => {
    expect(await isWorkerTypeQuotaBlocked("gemini", { now })).toBe(false);
  });

  it("does not block a worker type while another account for that type is usable", async () => {
    const runId = await insertRun();
    const exhaustedAccountId = await insertAccount("codex");
    await insertAccount("codex");
    const workerId = await insertWorker(runId, "codex", "cred-exhausted");
    await insertAllocation(runId, workerId, "codex", exhaustedAccountId);
    await insertIncident(runId, workerId, "open", new Date(now.getTime() + 60_000));

    expect(await isWorkerTypeQuotaBlocked("codex", { now })).toBe(false);
  });

  it("blocks a worker type when every usable account for that type is blocked", async () => {
    const runId = await insertRun();
    const firstAccountId = await insertAccount("codex");
    const secondAccountId = await insertAccount("codex");
    const firstWorkerId = await insertWorker(runId, "codex", "cred-exhausted");
    const secondWorkerId = await insertWorker(runId, "codex", "cred-exhausted");
    await insertAllocation(runId, firstWorkerId, "codex", firstAccountId);
    await insertAllocation(runId, secondWorkerId, "codex", secondAccountId);
    await insertIncident(runId, firstWorkerId, "open", new Date(now.getTime() + 60_000));
    await insertIncident(runId, secondWorkerId, "open", new Date(now.getTime() + 60_000));

    expect(await isWorkerTypeQuotaBlocked("codex", { now })).toBe(true);
  });
});

describe("quotaBlockedTypes", () => {
  beforeEach(async () => {
    await db.delete(supervisorScheduledWakes);
    await db.delete(executionEvents);
    await db.delete(recoveryIncidents);
    await db.delete(workerCredentialAllocations);
    await db.delete(workers);
    await db.delete(accounts);
    await db.delete(runs);
    await db.delete(plans);
  });

  it("returns a map of blocked types with reason and resumeAt", async () => {
    const runId = await insertRun();
    const codexWorker = await insertWorker(runId, "codex", "cred-exhausted");
    const resumeAt = new Date(now.getTime() + 60_000);
    await insertIncident(runId, codexWorker, "open", resumeAt);

    const blocked = await quotaBlockedTypes(["codex", "claude"], { now });
    expect(blocked.has("codex")).toBe(true);
    expect(blocked.has("claude")).toBe(false);
    expect(blocked.get("codex")?.resumeAt?.toISOString()).toBe(resumeAt.toISOString());
  });

  it("skips types whose all incidents have expired resumeAt", async () => {
    const runId = await insertRun();
    const workerId = await insertWorker(runId, "codex", "cred-exhausted");
    await insertIncident(runId, workerId, "open", new Date(now.getTime() - 5_000));

    const blocked = await quotaBlockedTypes(["codex"], { now });
    expect(blocked.has("codex")).toBe(false);
  });

  it("returns an empty map when nothing is blocked", async () => {
    const runId = await insertRun();
    await insertWorker(runId, "claude", "working");
    const blocked = await quotaBlockedTypes(["codex", "claude"], { now });
    expect(blocked.size).toBe(0);
  });
});
