import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import os from "os";
import path from "path";
import { mkdir, mkdtemp, rm } from "fs/promises";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions, messages, plans, runs, settings, workerCounters, workers } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";

vi.mock("@/server/settings/crypto", () => ({
  shouldEncryptSetting: (key: string) => key.endsWith("_API_KEY"),
  encryptSettingValue: (value: string) => `encmock:${Buffer.from(value, "utf8").toString("base64")}`,
  decryptSettingValue: (value: string) => {
    if (value === "enc:v1:invalid-payload") {
      throw new Error("Unable to decrypt stored setting value.");
    }
    return value.startsWith("encmock:")
      ? Buffer.from(value.slice("encmock:".length), "base64").toString("utf8")
      : value;
  },
}));

import { GET, POST } from "@/app/api/settings/route";

describe("/api/settings", () => {
  let tempDirs: string[] = [];

  beforeEach(async () => {
    tempDirs = [];
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(runs);
    await db.delete(plans);
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
    await db.delete(settings);
  });

  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
    return Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))).then(() => undefined);
  });

  async function makeAuthenticatedRequest(url: string, init: RequestInit = {}) {
    const session = await createAuthSession({
      label: "Settings test",
      userAgent: "Vitest",
      authMethod: "password_login",
    });
    const headers = new Headers(init.headers);
    headers.set("cookie", `omni_session=${session.tokenValue}`);
    if (init.method && init.method !== "GET") {
      headers.set("origin", "http://localhost");
    }
    const { signal, ...requestInit } = init;
    const nextRequestInit: ConstructorParameters<typeof NextRequest>[1] = { ...requestInit, headers };
    if (signal) {
      nextRequestInit.signal = signal;
    }
    return new NextRequest(url, nextRequestInit);
  }

  it("stores encrypted values and returns only secret presence metadata to the client", async () => {
    const saveRequest = await makeAuthenticatedRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        TEST_SUPERVISOR_API_KEY: "top-secret-key",
        TEST_SUPERVISOR_MODEL: "gemini-3.5-flash",
      }),
    });

    const saveResponse = await POST(saveRequest);
    expect(saveResponse.status).toBe(200);

    const storedApiKey = await db.select().from(settings).where(eq(settings.key, "TEST_SUPERVISOR_API_KEY")).get();
    const storedModel = await db.select().from(settings).where(eq(settings.key, "TEST_SUPERVISOR_MODEL")).get();

    expect(storedApiKey?.value).toBe(`encmock:${Buffer.from("top-secret-key", "utf8").toString("base64")}`);
    expect(storedApiKey?.value).not.toContain("top-secret-key");
    expect(storedModel?.value).toBe("gemini-3.5-flash");

    const getResponse = await GET(await makeAuthenticatedRequest("http://localhost/api/settings"));
    expect(getResponse.status).toBe(200);

    const payload = await getResponse.json();
    expect(payload.values.TEST_SUPERVISOR_API_KEY).toBeUndefined();
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("gemini-3.5-flash");
    expect(payload.secrets.TEST_SUPERVISOR_API_KEY).toEqual({
      configured: true,
      updatedAt: expect.any(String),
    });
    expect(payload.diagnostics).toEqual([]);
    expect(payload.resourceSnapshot).toHaveProperty("memoryFreePercent");
    expect(payload.resourceSnapshot).toHaveProperty("totalMemoryMb");
    expect(payload.resourceSnapshot).toHaveProperty("diskFreeMb");
    expect(payload.resourceSnapshot).toHaveProperty("diskTotalMb");
  });

  it("does not fail the whole response when an old encrypted secret cannot be decrypted", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await db.insert(settings).values([
      { key: "TEST_SUPERVISOR_API_KEY", value: "enc:v1:invalid-payload", updatedAt: new Date() },
      { key: "TEST_SUPERVISOR_MODEL", value: "enc:v1:invalid-payload", updatedAt: new Date() },
      { key: "TEST_CREDIT_STRATEGY", value: "swap_account", updatedAt: new Date() },
    ]);

    const response = await GET(await makeAuthenticatedRequest("http://localhost/api/settings"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.values.TEST_SUPERVISOR_API_KEY).toBeUndefined();
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("enc:v1:invalid-payload");
    expect(payload.values.TEST_CREDIT_STRATEGY).toBe("swap_account");
    expect(payload.secrets.TEST_SUPERVISOR_API_KEY).toEqual({
      configured: true,
      updatedAt: expect.any(String),
    });
    expect(payload.diagnostics).toEqual([]);

    warnSpy.mockRestore();
  });

  it("keeps internal cache settings out of the public settings payload", async () => {
    await db.insert(settings).values([
      { key: "__WORKER_MODEL_CATALOG_CACHE", value: "{\"catalog\":{}}", updatedAt: new Date() },
      { key: "TEST_SUPERVISOR_MODEL", value: "gemini-3.5-flash", updatedAt: new Date() },
    ]);

    const response = await GET(await makeAuthenticatedRequest("http://localhost/api/settings"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.values.__WORKER_MODEL_CATALOG_CACHE).toBeUndefined();
    expect(payload.secrets.__WORKER_MODEL_CATALOG_CACHE).toBeUndefined();
    expect(payload.values.TEST_SUPERVISOR_MODEL).toBe("gemini-3.5-flash");
  });

  it("canonicalizes stale run and worker roots to the configured project root", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "omni-project-root-"));
    tempDirs.push(tempDir);
    const oldRoot = path.join(tempDir, "old-name");
    const newRoot = path.join(tempDir, "new-name");
    await mkdir(newRoot);
    const oldWorkerCwd = path.join(oldRoot, "packages", "app");
    const newWorkerCwd = path.join(newRoot, "packages", "app");
    const now = new Date();

    await db.insert(plans).values({
      id: "plan-1",
      path: "vibes/ad-hoc/2026-04-20T14-34-11.md",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: "run-1",
      planId: "plan-1",
      mode: "direct",
      projectPath: oldRoot,
      title: "Follow renamed project",
      status: "done",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(workers).values({
      id: "worker-1",
      runId: "run-1",
      type: "codex",
      status: "done",
      cwd: oldWorkerCwd,
      createdAt: now,
      updatedAt: now,
    });

    const saveRequest = await makeAuthenticatedRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        PROJECTS: JSON.stringify([newRoot]),
      }),
    });

    const saveResponse = await POST(saveRequest);
    expect(saveResponse.status).toBe(200);

    const storedRun = await db.select().from(runs).where(eq(runs.id, "run-1")).get();
    const storedWorker = await db.select().from(workers).where(eq(workers.id, "worker-1")).get();

    expect(storedRun?.projectPath).toBe(newRoot);
    expect(storedWorker?.cwd).toBe(newWorkerCwd);
  });

  it("canonicalizes stale roots to the single empty project when other configured projects already have sessions", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "omni-project-root-"));
    tempDirs.push(tempDir);
    const oldRoot = path.join(tempDir, "opencut");
    const newRoot = path.join(tempDir, "directorscut");
    const otherRoot = path.join(tempDir, "omniharness");
    await mkdir(newRoot);
    await mkdir(otherRoot);
    const now = new Date();

    await db.insert(plans).values([
      {
        id: "plan-old",
        path: "vibes/ad-hoc/2026-04-20T14-34-11.md",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "plan-other",
        path: "vibes/ad-hoc/2026-04-21T14-34-11.md",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(runs).values([
      {
        id: "run-old",
        planId: "plan-old",
        mode: "direct",
        projectPath: oldRoot,
        title: "Old direct session",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "run-other",
        planId: "plan-other",
        mode: "direct",
        projectPath: otherRoot,
        title: "Other project session",
        status: "done",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.insert(workers).values({
      id: "worker-old",
      runId: "run-old",
      type: "codex",
      status: "done",
      cwd: path.join(oldRoot, "packages", "app"),
      createdAt: now,
      updatedAt: now,
    });

    const saveRequest = await makeAuthenticatedRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify({
        PROJECTS: JSON.stringify([otherRoot, newRoot]),
      }),
    });

    const saveResponse = await POST(saveRequest);
    expect(saveResponse.status).toBe(200);

    const storedOldRun = await db.select().from(runs).where(eq(runs.id, "run-old")).get();
    const storedOtherRun = await db.select().from(runs).where(eq(runs.id, "run-other")).get();
    const storedWorker = await db.select().from(workers).where(eq(workers.id, "worker-old")).get();

    expect(storedOldRun?.projectPath).toBe(newRoot);
    expect(storedOtherRun?.projectPath).toBe(otherRoot);
    expect(storedWorker?.cwd).toBe(path.join(newRoot, "packages", "app"));
  });
});
