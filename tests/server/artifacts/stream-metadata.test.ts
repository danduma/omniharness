import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateWhere } = vi.hoisted(() => ({
  updateWhere: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    update: () => ({
      set: () => ({
        where: updateWhere,
      }),
    }),
  },
}));

vi.mock("@/server/db/retry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/db/retry")>();
  return {
    ...actual,
    withSqliteBusyRetry: (operation: () => Promise<unknown>) => operation(),
  };
});

import {
  __resetNamedEventsForTests,
  getNamedEventsSince,
} from "@/server/events/named-events";
import {
  __resetArtifactStreamCachesForTests,
  commitArtifactAppend,
  reserveNextArtifactSeq,
} from "@/server/artifacts/stream-metadata";

describe("artifact stream metadata", () => {
  beforeEach(() => {
    updateWhere.mockReset();
    __resetArtifactStreamCachesForTests();
    __resetNamedEventsForTests();
  });

  it("defers a busy cursor update after the durable JSONL append", async () => {
    updateWhere.mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));

    await expect(commitArtifactAppend({
      streamId: {
        runId: "run-busy-stream",
        kind: "worker_entries",
        ownerId: "run-busy-stream-worker-1",
      },
      seq: 42,
      recordId: "record-42",
    })).resolves.toBeUndefined();

    expect(getNamedEventsSince(0, { runId: "run-busy-stream" }).events.map((entry) => entry.event))
      .toContainEqual({
        kind: "artifact.metadata_update_deferred",
        runId: "run-busy-stream",
        streamKind: "worker_entries",
        ownerId: "run-busy-stream-worker-1",
        seq: 42,
        reason: "SQLITE_BUSY: database is locked",
      });
    await expect(reserveNextArtifactSeq({
      runId: "run-busy-stream",
      kind: "worker_entries",
      ownerId: "run-busy-stream-worker-1",
    })).resolves.toBe(43);
  });

  it("still rejects non-lock metadata failures", async () => {
    updateWhere.mockRejectedValue(new Error("disk I/O error"));

    await expect(commitArtifactAppend({
      streamId: {
        runId: "run-broken-stream",
        kind: "worker_entries",
        ownerId: "run-broken-stream-worker-1",
      },
      seq: 7,
      recordId: "record-7",
    })).rejects.toThrow("disk I/O error");

    expect(getNamedEventsSince(0, { runId: "run-broken-stream" }).events).toHaveLength(0);
  });
});
