import { describe, expect, it } from "vitest";
import {
  deriveConversationLoadState,
  isWorkerStreamCaughtUp,
  resolveDirectWorkerStreamRefreshInterval,
  selectDirectConversationEntries,
  shouldShowDirectConversationLoading,
  shouldShowDirectWorkerStreamInitialLoading,
} from "@/app/home/direct-worker-stream-loading";
import type { WorkerStreamState } from "@/app/home/WorkerEntriesManager";
import type { WorkerEntry } from "@/server/workers/entries-types";

function buildState(overrides: Partial<WorkerStreamState> = {}): WorkerStreamState {
  return {
    workerId: "worker-1",
    entries: [],
    lowestSeq: 0,
    latestContiguousSeq: 0,
    latestKnownSeq: 0,
    hasOlder: false,
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
  it("derives a deterministic full-load state from snapshot and worker stream facts", () => {
    expect(deriveConversationLoadState({
      snapshotLoaded: false,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loaded", latestContiguousSeq: 0, latestKnownSeq: 0 }),
    })).toMatchObject({
      snapshotLoaded: false,
      workerStreamRequired: true,
      workerStreamLoaded: true,
      fullyLoaded: false,
      loadingReason: "snapshot",
    });

    expect(deriveConversationLoadState({
      snapshotLoaded: true,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loading", latestContiguousSeq: 0, latestKnownSeq: 2 }),
    })).toMatchObject({
      snapshotLoaded: true,
      workerStreamRequired: true,
      workerStreamLoaded: false,
      fullyLoaded: false,
      loadingReason: "worker_stream",
    });

    expect(deriveConversationLoadState({
      snapshotLoaded: true,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loaded", latestContiguousSeq: 2, latestKnownSeq: 2 }),
    })).toMatchObject({
      workerStreamLoaded: true,
      fullyLoaded: true,
      loadingReason: null,
    });
  });

  it("does not block terminal direct runs on worker stream catch-up", () => {
    expect(deriveConversationLoadState({
      snapshotLoaded: true,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loading", latestContiguousSeq: 0, latestKnownSeq: 3 }),
      selectedRunIsTerminal: true,
    })).toMatchObject({
      workerStreamRequired: false,
      workerStreamLoaded: true,
      fullyLoaded: true,
      loadingReason: null,
    });
  });

  it("defines worker stream caught-up as loaded through the known cursor", () => {
    expect(isWorkerStreamCaughtUp(buildState({
      status: "loaded",
      latestContiguousSeq: 3,
      latestKnownSeq: 3,
    }))).toBe(true);
    expect(isWorkerStreamCaughtUp(buildState({
      status: "loading",
      latestContiguousSeq: 3,
      latestKnownSeq: 3,
    }))).toBe(false);
    expect(isWorkerStreamCaughtUp(buildState({
      status: "loaded",
      latestContiguousSeq: 2,
      latestKnownSeq: 3,
    }))).toBe(false);
  });

  it("shows loading immediately before the first worker stream fetch starts", () => {
    expect(shouldShowDirectWorkerStreamInitialLoading({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "idle" }),
    })).toBe(true);
  });

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

  it("keeps merged multi-worker transcript visible while the replacement worker stream is empty", () => {
    const previousWorkerEntry = {
      ...entry(1),
      id: "old-worker-output",
      text: "previous worker output",
      workerId: "worker-1",
    };

    expect(selectDirectConversationEntries({
      transcriptEntries: [previousWorkerEntry],
      directWorkerEntries: [],
    })).toEqual([previousWorkerEntry]);
  });

  it("adds replacement worker entries without dropping the prior multi-worker transcript", () => {
    const previousWorkerEntry = {
      ...entry(1),
      id: "old-worker-output",
      text: "previous worker output",
      workerId: "worker-1",
    };
    const replacementWorkerEntry = {
      ...entry(2),
      id: "new-worker-output",
      text: "new worker output",
    };

    expect(selectDirectConversationEntries({
      transcriptEntries: [previousWorkerEntry],
      directWorkerEntries: [replacementWorkerEntry],
    }).map((item) => item.id)).toEqual([
      "old-worker-output",
      "new-worker-output",
    ]);
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

  it("uses full-load state as the visible direct conversation loading guard", () => {
    expect(shouldShowDirectConversationLoading(deriveConversationLoadState({
      snapshotLoaded: true,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loading", latestContiguousSeq: 1, latestKnownSeq: 2 }),
    }))).toBe(true);

    expect(shouldShowDirectConversationLoading(deriveConversationLoadState({
      snapshotLoaded: true,
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      streamState: buildState({ status: "loaded", latestContiguousSeq: 2, latestKnownSeq: 2 }),
    }))).toBe(false);
  });

  it("keeps selected direct worker streams on a validation refresh after work looks idle", () => {
    expect(resolveDirectWorkerStreamRefreshInterval({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      activeRefreshIntervalMs: 2_000,
      validationIntervalMs: 5_000,
      showDirectControlWorkingIndicator: true,
    })).toBe(2_000);

    expect(resolveDirectWorkerStreamRefreshInterval({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      activeRefreshIntervalMs: 2_000,
      validationIntervalMs: 5_000,
      showDirectControlWorkingIndicator: false,
    })).toBe(5_000);

    expect(resolveDirectWorkerStreamRefreshInterval({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: null,
      activeRefreshIntervalMs: 2_000,
      validationIntervalMs: 5_000,
      showDirectControlWorkingIndicator: false,
    })).toBeNull();

    expect(resolveDirectWorkerStreamRefreshInterval({
      unifiedWorkerStreamEnabled: true,
      primaryConversationWorkerId: "worker-1",
      activeRefreshIntervalMs: 2_000,
      validationIntervalMs: 5_000,
      showDirectControlWorkingIndicator: false,
      selectedRunIsTerminal: true,
    })).toBeNull();
  });
});
