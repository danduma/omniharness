import type { WorkerStreamState } from "./WorkerEntriesManager";

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
}): ConversationLoadState {
  const workerStreamRequired = Boolean(
    args.unifiedWorkerStreamEnabled
      && args.primaryConversationWorkerId
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
