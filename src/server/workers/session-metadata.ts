import { appendWorkerEntryWithResult, readWorkerOutputEntries } from "@/server/workers/output-store";

const WORKER_SESSION_METADATA_KIND = "worker_session_metadata";

export type WorkerSessionMetadata = {
  sessionId: string;
  sessionMode: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMetadataRaw(value: unknown): WorkerSessionMetadata | null {
  if (!isRecord(value) || value.kind !== WORKER_SESSION_METADATA_KIND) {
    return null;
  }
  const sessionId = typeof value.sessionId === "string" ? value.sessionId.trim() : "";
  if (!sessionId) {
    return null;
  }
  return {
    sessionId,
    sessionMode: typeof value.sessionMode === "string" && value.sessionMode.trim()
      ? value.sessionMode.trim()
      : null,
  };
}

export async function appendWorkerSessionMetadata(args: {
  runId: string;
  workerId: string;
  sessionId: string | null | undefined;
  sessionMode?: string | null;
  source: string;
}) {
  const sessionId = args.sessionId?.trim();
  if (!sessionId) {
    return null;
  }

  return appendWorkerEntryWithResult(args.runId, args.workerId, {
    id: `worker-session-metadata:${sessionId}`,
    type: "lifecycle",
    text: "Worker ACP session metadata saved.",
    timestamp: new Date().toISOString(),
    authorRole: "system",
    channel: "system",
    raw: {
      kind: WORKER_SESSION_METADATA_KIND,
      sessionId,
      sessionMode: args.sessionMode?.trim() || null,
      source: args.source,
    },
  });
}

export async function readWorkerSessionMetadata(runId: string, workerId: string): Promise<WorkerSessionMetadata | null> {
  const entries = await readWorkerOutputEntries(runId, workerId);
  for (const entry of [...entries].reverse()) {
    const metadata = readMetadataRaw(entry.raw);
    if (metadata) {
      return metadata;
    }
  }
  return null;
}
