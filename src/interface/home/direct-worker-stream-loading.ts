import type { WorkerStreamState } from "./WorkerEntriesManager";
import { coalesceWorkerEntriesById } from "./WorkerEntriesManager";
import type { WorkerEntry } from "@/shared/worker-entries";
import { isSupersededSeq, withoutSupersededEntries, type SupersededSeqRange } from "@/lib/superseded-entries";

export type ConversationLoadState = {
  snapshotLoaded: boolean;
  workerStreamRequired: boolean;
  workerStreamLoaded: boolean;
  fullyLoaded: boolean;
  loadingReason: "snapshot" | "worker_stream" | null;
};

export function isWorkerStreamCaughtUp(streamState: WorkerStreamState) {
  return (
    streamState.status === "loaded"
    && streamState.latestContiguousSeq === streamState.latestKnownSeq
  );
}

export function deriveConversationLoadState(args: {
  snapshotLoaded: boolean;
  unifiedWorkerStreamEnabled: boolean;
  primaryConversationWorkerId: string | null | undefined;
  streamState: WorkerStreamState;
  selectedRunIsTerminal?: boolean;
}): ConversationLoadState {
  const workerStreamRequired = Boolean(
    args.unifiedWorkerStreamEnabled
      && args.primaryConversationWorkerId
      && !args.selectedRunIsTerminal
  );
  const workerStreamLoaded = !workerStreamRequired || isWorkerStreamCaughtUp(args.streamState);
  const fullyLoaded = args.snapshotLoaded && workerStreamLoaded;
  const loadingReason = !args.snapshotLoaded
    ? "snapshot"
    : !workerStreamLoaded
      ? "worker_stream"
      : null;

  return {
    snapshotLoaded: args.snapshotLoaded,
    workerStreamRequired,
    workerStreamLoaded,
    fullyLoaded,
    loadingReason,
  };
}

export function shouldShowDirectWorkerStreamInitialLoading(args: {
  unifiedWorkerStreamEnabled: boolean;
  primaryConversationWorkerId: string | null | undefined;
  streamState: WorkerStreamState;
}) {
  return deriveConversationLoadState({
    ...args,
    snapshotLoaded: true,
  }).loadingReason === "worker_stream"
    && (args.streamState.status === "idle" || args.streamState.status === "loading")
    && args.streamState.entries.length === 0;
}

export function shouldShowDirectConversationLoading(args: ConversationLoadState) {
  return Boolean(
    !args.fullyLoaded
    && args.loadingReason === "worker_stream"
  );
}

export function resolveConversationRanOnMultipleWorkers(args: {
  transcriptWorkerIds: ReadonlyArray<string>;
  snapshotWorkerIds: ReadonlyArray<string>;
}): boolean | undefined {
  const workerIds = new Set([
    ...args.transcriptWorkerIds,
    ...args.snapshotWorkerIds,
  ].filter(Boolean));

  return workerIds.size > 0 ? workerIds.size > 1 : undefined;
}

export function selectDirectConversationEntries<T extends WorkerEntry>(args: {
  transcriptEntries: T[];
  directWorkerEntries: T[];
  // Ranges the live worker wrote for a branch a retry/edit discarded. The
  // transcript already drops them server-side; the live stream is served from
  // the raw JSONL (no database read on that hot path), so they are filtered
  // here before the two sources are merged — otherwise the rewound turn walks
  // straight back into the conversation.
  supersededSeqRanges?: SupersededSeqRange[];
  // The worker `supersededSeqRanges` belongs to. Transcript entries for this
  // worker are re-filtered here even though the server already drops them:
  // the client's transcript cache only pages forward, so entries fetched
  // before a rewind stay in memory carrying seqs the rewind later superseded.
  primaryWorkerId?: string | null;
  // The run's workers in creation order, so a message that exists on more than
  // one of them is placed where the newest worker has it.
  workerOrder?: ReadonlyArray<string>;
}) {
  const supersededSeqRanges = args.supersededSeqRanges ?? [];
  const directWorkerEntries = withoutSupersededEntries(
    args.directWorkerEntries,
    supersededSeqRanges,
  );
  const transcriptEntries = args.primaryWorkerId && supersededSeqRanges.length > 0
    ? args.transcriptEntries.filter((entry) => {
      const workerId = (entry as T & { workerId?: unknown }).workerId;
      return workerId !== args.primaryWorkerId
        || !isSupersededSeq(entry.seq, supersededSeqRanges);
    })
    : args.transcriptEntries;

  if (transcriptEntries.length === 0) {
    return directWorkerEntries;
  }

  return coalesceWorkerEntriesById([
    ...transcriptEntries,
    ...directWorkerEntries,
  ], args.workerOrder ?? []) as T[];
}

export function resolveDirectWorkerStreamRefreshInterval(args: {
  unifiedWorkerStreamEnabled: boolean;
  primaryConversationWorkerId: string | null | undefined;
  activeRefreshIntervalMs: number;
  validationIntervalMs: number;
  showDirectControlWorkingIndicator: boolean;
  selectedRunIsTerminal?: boolean;
}) {
  if (!args.unifiedWorkerStreamEnabled || !args.primaryConversationWorkerId) {
    return null;
  }

  // `worker.entry_appended` SSE frames fetch new content immediately. These
  // timers are only a safety net for a missed wake-up, so keep them out of the
  // packet hot path on mobile connections.
  const minimumActiveRefreshIntervalMs = 30_000;
  const minimumValidationIntervalMs = 60_000;
  return args.showDirectControlWorkingIndicator
    ? Math.max(args.activeRefreshIntervalMs, minimumActiveRefreshIntervalMs)
    : Math.max(args.validationIntervalMs, minimumValidationIntervalMs);
}
