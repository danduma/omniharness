import type { APIRequestContext } from "@playwright/test";
import type { ClaudeModelGatewayStatus } from "@/lib/claude-model-gateway";
import type { LiveJourneyManifest } from "./types";

export interface NamedEventRecord {
  id: number;
  emittedAt: string;
  runId: string | null;
  event: { kind: string; [key: string]: unknown };
}

export interface QueueRecord {
  id: string;
  status: string;
}

export function parseSnapshotAnchor(rawHeader: string | null): number {
  const anchor = Number.parseInt(rawHeader?.trim() ?? "", 10);
  if (!Number.isFinite(anchor) || anchor < 0) {
    throw new Error("Canonical snapshot response is missing a valid event anchor.");
  }
  return anchor;
}

export function scopeNamedEventsToOwnedRuns<T extends { runId: string | null }>(
  records: T[],
  ownedRunIds: Iterable<string>,
): T[] {
  const owned = new Set(ownedRunIds);
  return records.filter((record) => record.runId !== null && owned.has(record.runId));
}

export function orderNamedEvents<T extends { id: number; emittedAt: string }>(records: T[]): T[] {
  return [...records].sort((left, right) => (
    left.id - right.id
    || left.emittedAt.localeCompare(right.emittedAt)
  ));
}

export function isWorkerSettledNamedEvent(record: NamedEventRecord): boolean {
  return record.event.kind === "worker.terminal"
    || (record.event.kind === "worker.status" && record.event.next === "idle");
}

export function assertMonotonicWorkerSeqs(entries: Array<{ seq: number }>): number {
  let latestSeq = 0;
  for (const entry of entries) {
    if (!Number.isInteger(entry.seq) || entry.seq <= latestSeq) {
      throw new Error(`Worker stream sequence is not strictly increasing at ${entry.seq}.`);
    }
    latestSeq = entry.seq;
  }
  return latestSeq;
}

export function compareQueueState(
  visible: QueueRecord[],
  server: QueueRecord[],
): { matches: boolean; mismatches: string[] } {
  const visibleById = new Map(visible.map((record) => [record.id, record.status]));
  const serverById = new Map(server.map((record) => [record.id, record.status]));
  const ids = [...new Set([...visibleById.keys(), ...serverById.keys()])].sort();
  const mismatches = ids.flatMap((id) => {
    const visibleStatus = visibleById.get(id) ?? "missing";
    const serverStatus = serverById.get(id) ?? "missing";
    return visibleStatus === serverStatus
      ? []
      : [`${id}: visible=${visibleStatus} server=${serverStatus}`];
  });
  return { matches: mismatches.length === 0, mismatches };
}

export async function fetchCanonicalSnapshot(
  request: APIRequestContext,
  runId?: string,
): Promise<{ anchor: number; body: Record<string, unknown> }> {
  const query = new URLSearchParams({ snapshot: "1", persisted: "1" });
  if (runId) query.set("runId", runId);
  const response = await request.get(`/api/events?${query.toString()}`);
  if (!response.ok()) {
    throw new Error(`Canonical snapshot failed with status ${response.status()}.`);
  }
  return {
    anchor: parseSnapshotAnchor(response.headers()["x-omni-last-event-id"] ?? null),
    body: await response.json() as Record<string, unknown>,
  };
}

export async function fetchOwnedNamedEvents(
  request: APIRequestContext,
  manifest: LiveJourneyManifest,
  since: number,
): Promise<NamedEventRecord[]> {
  const query = new URLSearchParams({ since: String(since) });
  const response = await request.get(`/api/events/log?${query.toString()}`);
  if (!response.ok()) {
    throw new Error(`Named event log failed with status ${response.status()}.`);
  }
  const payload = await response.json() as { events?: NamedEventRecord[] };
  return orderNamedEvents(scopeNamedEventsToOwnedRuns(
    payload.events ?? [],
    manifest.runs.map((run) => run.id),
  ));
}

export async function fetchWorkerEntries(
  request: APIRequestContext,
  workerId: string,
): Promise<{ entries: Array<{ seq: number; [key: string]: unknown }>; latestSeq: number }> {
  const response = await request.get(`/api/workers/${encodeURIComponent(workerId)}/entries?afterSeq=0`);
  if (!response.ok()) {
    throw new Error(`Worker entry read failed with status ${response.status()}.`);
  }
  const payload = await response.json() as {
    entries?: Array<{ seq: number; [key: string]: unknown }>;
    latestSeq?: number;
  };
  const entries = payload.entries ?? [];
  const observedLatestSeq = assertMonotonicWorkerSeqs(entries);
  const latestSeq = payload.latestSeq ?? observedLatestSeq;
  if (latestSeq < observedLatestSeq) {
    throw new Error("Worker stream latest sequence is older than returned entries.");
  }
  return { entries, latestSeq };
}

export async function fetchClaudeGatewayStatus(
  request: APIRequestContext,
): Promise<ClaudeModelGatewayStatus> {
  const response = await request.get("/api/integrations/claude-model-gateway");
  if (!response.ok()) {
    throw new Error(`Claude model gateway preflight failed with status ${response.status()}.`);
  }
  const payload = await response.json() as { status: ClaudeModelGatewayStatus };
  return payload.status;
}

export function assertClaudeGatewayReady(
  status: ClaudeModelGatewayStatus,
  requiredRawModel = "gpt-5.6-sol",
): void {
  const modelIds = new Set([
    ...status.models.custom.map((model) => model.id),
    ...status.models.discovered.map((model) => model.id),
  ]);
  if (!status.enabled
    || status.service !== "running"
    || status.oauth !== "connected"
    || !modelIds.has(requiredRawModel)) {
    throw new Error(`Claude model gateway is not ready for ${requiredRawModel}.`);
  }
}
