import { describe, expect, it } from "vitest";
import { shouldShowDirectWorkerStreamInitialLoading } from "@/app/home/direct-worker-stream-loading";
import type { WorkerStreamState } from "@/app/home/WorkerEntriesManager";
import type { WorkerEntry } from "@/server/workers/entries-types";

function buildState(overrides: Partial<WorkerStreamState> = {}): WorkerStreamState {
  return {
    workerId: "worker-1",
    entries: [],
    latestContiguousSeq: 0,
    latestKnownSeq: 0,
    status: "idle",
    lastError: null,
    ...overrides,
  };
}

function entry(seq: number): WorkerEntry {
  return {
    id: `entry-${seq}`,
    seq,
    type: "message",
    text: `message ${seq}`,
    timestamp: "2026-05-17T00:00:00.000Z",
  };
}

describe("shouldShowDirectWorkerStreamInitialLoading", () => {
  it("blocks direct conversation rendering during the first worker stream fetch", () => {
    expect(shouldShowDirectWorkerStreamInitialLoading({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loading" }),
    })).toBe(true);
  });

  it("keeps the existing transcript visible during incremental worker stream refreshes", () => {
    expect(shouldShowDirectWorkerStreamInitialLoading({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({
        entries: [entry(1)],
        latestContiguousSeq: 1,
        latestKnownSeq: 2,
        status: "loading",
      }),
    })).toBe(false);
  });

  it("does not block rendering when the stream request failed", () => {
    expect(shouldShowDirectWorkerStreamInitialLoading({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({
        status: "error",
        lastError: "Request failed",
      }),
    })).toBe(false);
  });
});
