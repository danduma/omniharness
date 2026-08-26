import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs, workers } from "@/server/db/schema";
import { getAppDataPath } from "@/server/app-root";
import { appendWorkerEntry } from "@/server/workers/output-store";
import { __resetNamedEventsForTests } from "@/server/events/named-events";
import { workerEntriesRoute as GET } from "@/../tests/helpers/runtime-routes";

/**
 * A payload comfortably past the 4,000-char generic raw-string bound, so any
 * regression that re-enables truncation for image content fails these tests.
 */
const IMAGE_BYTES = Buffer.from(
  Array.from({ length: 9_000 }, (_, index) => (index * 31 + 7) % 256),
);
const IMAGE_BASE64 = IMAGE_BYTES.toString("base64");

function archivePathFor(workerId: string) {
  return path.join(process.cwd(), ".omniharness", "agent-runtime-output", `${workerId}.jsonl`);
}

async function seedWorker(runId: string, planId: string, workerId: string, projectPath: string) {
  const now = new Date();
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
    type: "claude",
    status: "idle",
    cwd: projectPath,
    outputLog: "",
    outputEntriesJson: "[]",
    currentText: "",
    lastText: "",
    createdAt: now,
    updatedAt: now,
  });
  return now;
}

async function cleanup(runId: string, planId: string, projectPath: string, workerId: string) {
  await db.delete(workers).where(eq(workers.runId, runId));
  await db.delete(runs).where(eq(runs.id, runId));
  await db.delete(plans).where(eq(plans.id, planId));
  await fs.rm(path.join(getAppDataPath("run-data"), runId), { recursive: true, force: true });
  await fs.rm(archivePathFor(workerId), { force: true });
  await fs.rm(projectPath, { recursive: true, force: true });
}

describe("worker entry image content", () => {
  const previousBypassAuth = process.env.OMNIHARNESS_TEST_BYPASS_AUTH;

  afterEach(() => {
    __resetNamedEventsForTests();
    if (previousBypassAuth == null) {
      delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    } else {
      process.env.OMNIHARNESS_TEST_BYPASS_AUTH = previousBypassAuth;
    }
  });

  it("keeps an inline image payload decodable through the persisted stream", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-inline-image-"));

    try {
      const now = await seedWorker(runId, planId, workerId, projectPath);
      await appendWorkerEntry(runId, workerId, {
        id: "inline-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: { content: { type: "image", data: IMAGE_BASE64, mimeType: "image/png" } },
      });

      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?contentEntryId=inline-image`),
        { params: Promise.resolve({ workerId }) },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE_BYTES);
    } finally {
      await cleanup(runId, planId, projectPath, workerId);
    }
  });

  it("replaces the inline payload with a content pointer on the entries response", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-elide-image-"));

    try {
      const now = await seedWorker(runId, planId, workerId, projectPath);
      await appendWorkerEntry(runId, workerId, {
        id: "inline-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: { content: { type: "image", data: IMAGE_BASE64, mimeType: "image/png" } },
      });

      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?afterSeq=0`),
        { params: Promise.resolve({ workerId }) },
      );

      expect(response.status).toBe(200);
      const body = await response.json() as {
        entries: Array<{ id: string; raw?: { content?: Record<string, unknown> } }>;
      };
      const entry = body.entries.find((candidate) => candidate.id === "inline-image");
      expect(entry?.raw?.content).toBeDefined();
      expect(entry?.raw?.content?.data).toBeUndefined();
      expect(entry?.raw?.content?.mimeType).toBe("image/png");
      expect(entry?.raw?.content?.omniWorkerContent).toEqual({ workerId, entryId: "inline-image" });
      // The whole page must stay small even though the stream holds the image.
      expect(JSON.stringify(body).length).toBeLessThan(IMAGE_BASE64.length);
    } finally {
      await cleanup(runId, planId, projectPath, workerId);
    }
  });

  it("falls back to the runtime archive when the stream holds a truncated payload", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-archived-image-"));

    try {
      const now = await seedWorker(runId, planId, workerId, projectPath);
      // Mirrors a transcript written before image payloads were exempted from
      // raw-string compaction: the stream kept only an undecodable prefix.
      await appendWorkerEntry(runId, workerId, {
        id: "archived-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: {
          content: {
            type: "image",
            data: `${IMAGE_BASE64.slice(0, 2_000)}\n[truncated 10000 chars]`,
            mimeType: "image/png",
          },
        },
      });

      const archivePath = archivePathFor(workerId);
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await fs.writeFile(archivePath, `${JSON.stringify({
        id: "archived-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: { content: { type: "image", data: IMAGE_BASE64, mimeType: "image/png" } },
      })}\n`);

      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?contentEntryId=archived-image`),
        { params: Promise.resolve({ workerId }) },
      );

      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(IMAGE_BYTES);
    } finally {
      await cleanup(runId, planId, projectPath, workerId);
    }
  });

  it("reports an unresolvable payload with a message the client can show", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), "omniharness-missing-image-"));

    try {
      const now = await seedWorker(runId, planId, workerId, projectPath);
      await appendWorkerEntry(runId, workerId, {
        id: "missing-image",
        type: "agent_content",
        text: "image",
        timestamp: now.toISOString(),
        raw: {
          content: {
            type: "image",
            data: "iVBORw0K\n[truncated 10000 chars]",
            mimeType: "image/png",
          },
        },
      });

      const response = await GET(
        new Request(`http://localhost/api/workers/${workerId}/entries?contentEntryId=missing-image`),
        { params: Promise.resolve({ workerId }) },
      );

      expect(response.status).toBe(404);
      const body = await response.json() as { error?: { message?: string } };
      expect(body.error?.message).toBe("Generated image data is unavailable.");
    } finally {
      await cleanup(runId, planId, projectPath, workerId);
    }
  });
});
