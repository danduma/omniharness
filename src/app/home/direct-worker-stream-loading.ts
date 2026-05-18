import type { WorkerStreamState } from "./WorkerEntriesManager";

export function shouldShowDirectWorkerStreamInitialLoading(args: {
  unifiedWorkerStreamEnabled: boolean;
  primaryConversationWorkerId: string | null | undefined;
  streamState: WorkerStreamState;
}) {
  return Boolean(
    args.unifiedWorkerStreamEnabled
    && args.primaryConversationWorkerId
    && args.streamState.status === "loading"
    && args.streamState.entries.length === 0
    && args.streamState.latestContiguousSeq === 0
  );
}
