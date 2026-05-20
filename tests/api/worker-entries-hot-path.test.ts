import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppDataPath } from "@/server/app-root";

const { dbImportSpy, schemaImportSpy } = vi.hoisted(() => ({
  dbImportSpy: vi.fn(),
  schemaImportSpy: vi.fn(),
}));

vi.mock("@/server/db", () => {
  dbImportSpy();
  throw new Error("worker entries hot path imported @/server/db");
});

vi.mock("@/server/db/schema", () => {
  schemaImportSpy();
  throw new Error("worker entries hot path imported @/server/db/schema");
});

import { GET } from "@/app/api/workers/[workerId]/entries/route";

async function writeWorkerJsonl(runId: string, workerId: string) {
  const dir = getAppDataPath("run-data", runId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${workerId}.jsonl`), [
    JSON.stringify({
      id: "entry-1",
      seq: 1,
      type: "message",
      text: "hello",
      timestamp: "2026-01-01T00:00:00.000Z",
    }),
  ].join("\n") + "\n", "utf8");
}

describe("worker entries hot path", () => {
  afterEach(() => {
    dbImportSpy.mockClear();
    schemaImportSpy.mockClear();
  });

  it("rejects missing auth before importing database-backed session state", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "false";

    const workerId = `${randomUUID()}-worker-1`;
    const response = await GET(
      new NextRequest(`http://localhost/api/workers/${workerId}/entries?afterSeq=0`),
      { params: Promise.resolve({ workerId }) },
    );

    expect(response.status).toBe(401);
    expect(dbImportSpy).not.toHaveBeenCalled();
    expect(schemaImportSpy).not.toHaveBeenCalled();
  });

  it("serves inferred run-id worker streams without importing the database", async () => {
    process.env.OMNIHARNESS_TEST_BYPASS_AUTH = "true";
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    try {
      await writeWorkerJsonl(runId, workerId);

      const response = await GET(
        new NextRequest(`http://localhost/api/workers/${workerId}/entries?afterSeq=0`),
        { params: Promise.resolve({ workerId }) },
      );
      const payload = await response.json() as { entries: Array<{ seq: number; text: string }>; latestSeq: number };

      expect(response.status).toBe(200);
      expect(payload.entries).toEqual([expect.objectContaining({ seq: 1, text: "hello" })]);
      expect(payload.latestSeq).toBe(1);
      expect(dbImportSpy).not.toHaveBeenCalled();
      expect(schemaImportSpy).not.toHaveBeenCalled();
    } finally {
      await fs.rm(getAppDataPath("run-data", runId), { recursive: true, force: true });
    }
  });
});
