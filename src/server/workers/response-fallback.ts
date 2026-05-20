import type { AgentRecord } from "@/server/bridge-client";
import { appendAssistantMessageEntry } from "@/server/workers/stream-writer";

type SnapshotLike = Pick<AgentRecord, "outputEntries"> | null;

function snapshotHasAssistantMessage(snapshot: SnapshotLike) {
  return Boolean(snapshot?.outputEntries?.some((entry) => (
    (entry.type === "message" || entry.type === "thought")
    && entry.text.trim().length > 0
  )));
}

export async function appendAskResponseFallbackEntry(args: {
  runId: string;
  workerId: string;
  responseText: string | null | undefined;
  snapshot: SnapshotLike;
}) {
  const text = args.responseText?.trim();
  if (!text || snapshotHasAssistantMessage(args.snapshot)) {
    return;
  }

  await appendAssistantMessageEntry({
    runId: args.runId,
    workerId: args.workerId,
    text,
    raw: { source: "ask_response_fallback" },
  });
}
