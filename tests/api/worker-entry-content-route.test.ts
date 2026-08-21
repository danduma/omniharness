import { randomUUID } from "crypto";
import { constants } from "fs";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { appendWorkerEntry } from "@/server/workers/output-store";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { workerEntriesRoute as GET } from "@/../tests/helpers/runtime-routes";

async function cleanup(runId: string, planId: string, projectPath: string) {
  await db.delete(workers).where(eq(workers.runId, runId));
  await db.delete(runs).where(eq(runs.id, runId));
  await db.delete(plans).where(eq(plans.id, planId));
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
  await fs.rm(projectPath, { recursive: true, force: true });
}

describe("GET /api/workers/:workerId/entries?contentEntryId=...", () => {
  const previousBypassAuth = process.env.OMNIHARNESS_TEST_BYPASS_AUTH;

  afterEach(() => {
    __resetNamedEventsForTests();
    if (previousBypassAuth == null) {
      delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    } else {
      process.env.OMNIHARNESS_TEST_BYPASS_AUTH = previousBypassAuth;
    }
  });

  it("serves a Codex-generated image referenced by a persisted worker entry", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-generated-image-"));
    const generatedImagePath = path.join(
      projectPath,
      ".omniharness",
      "cli-home",
      "codex",
      "home",
      "generated_images",
      "session-1",
      "image.png",
    );
    const imageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const now = new Date();

    try {
      await fs.mkdir(path.dirname(generatedImagePath), { recursive: true });
      await fs.writeFile(generatedImagePath, imageBytes);
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "done",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "codex",
        status: "idle",
        cwd: projectPath,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });
      await appendWorkerEntry(runId, workerId, {
        id: "generated-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: {
          content: {
            type: "image",
            data: "iVBORw0K\n[truncated 1000000 chars]",
            mimeType: "image/png",
            uri: generatedImagePath,
          },
        },
      });

      const openSpy = vi.spyOn(fs, "open");
      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?contentEntryId=generated-image`),
        { params: Promise.resolve({ workerId }) },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(imageBytes);
      expect(openSpy).toHaveBeenCalledWith(
        await fs.realpath(generatedImagePath),
        expect.any(Number),
      );
      const openFlags = openSpy.mock.calls.at(-1)?.[1];
      expect(typeof openFlags === "number" && (openFlags & constants.O_NOFOLLOW) !== 0).toBe(true);
    } finally {
      await cleanup(runId, planId, projectPath);
    }
  });

  it("refuses a generated-image entry whose URI resolves outside that worker's content root", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-generated-image-root-"));
    const outsidePath = path.join(projectPath, "outside.png");
    const now = new Date();

    try {
      await fs.mkdir(path.join(projectPath, ".omniharness", "cli-home", "codex", "home", "generated_images"), { recursive: true });
      await fs.writeFile(outsidePath, Buffer.from([1, 2, 3]));
      await db.insert(plans).values({
        id: planId,
        path: "vibes/ad-hoc/direct.md",
        status: "running",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(runs).values({
        id: runId,
        planId,
        mode: "direct",
        status: "done",
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(workers).values({
        id: workerId,
        runId,
        type: "codex",
        status: "idle",
        cwd: projectPath,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });
      await appendWorkerEntry(runId, workerId, {
        id: "unsafe-generated-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: {
          content: {
            type: "image",
            data: "iVBORw0K\n[truncated 1000000 chars]",
            mimeType: "image/png",
            uri: outsidePath,
          },
        },
      });

      const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?contentEntryId=unsafe-generated-image`),
        { params: Promise.resolve({ workerId }) },
      ).finally(() => errorLog.mockRestore());

      expect(response.status).toBe(403);
      expect(getNamedEventsSince(0, { runId }).events.map((item) => item.event)).toContainEqual(expect.objectContaining({
        kind: "error.surfaced",
        code: "worker.output_content_unavailable",
        runId,
        workerId,
      }));
    } finally {
      await cleanup(runId, planId, projectPath);
    }
  });
});
