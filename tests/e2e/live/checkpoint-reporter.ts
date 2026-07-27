import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type LiveMismatchKind =
  | "control_plane_missing_decision"
  | "persistence_finalization_gap"
  | "stream_delivery_gap"
  | "client_state_mismatch"
  | "visible_affordance_mismatch";

const SECRET_KEY_PATTERN = /(?:password|authorization|cookie|api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?url)/i;
const SECRET_VALUE_PATTERN = /(?:bearer\s+\S+|(?:password|api[_-]?key|access[_-]?token|refresh[_-]?token|oauth[_-]?url)=\S+)/i;

export interface LiveCheckpointRecord {
  step: string;
  timestamp: string;
  runId: string | null;
  visible: Record<string, unknown>;
  server: Record<string, unknown>;
  mismatch: LiveMismatchKind | null;
}

export function stableTextHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function redactLiveEvidence<T>(value: T): T {
  if (typeof value === "string") {
    return (SECRET_VALUE_PATTERN.test(value) ? "[REDACTED]" : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactLiveEvidence(entry)) as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactLiveEvidence(entry);
    }
    return result as T;
  }
  return value;
}

export function boundTextLines(value: string, maximumLines = 80): string {
  if (!Number.isInteger(maximumLines) || maximumLines < 1) {
    throw new Error("maximumLines must be a positive integer");
  }
  return value.split("\n").slice(-maximumLines).join("\n");
}

export function scopeEvidenceToOwnedRuns<T extends { runId?: string | null }>(
  records: T[],
  ownedRunIds: Iterable<string>,
): T[] {
  const owned = new Set(ownedRunIds);
  return records.filter((record) => typeof record.runId === "string" && owned.has(record.runId));
}

export function classifyLiveMismatch(args: {
  namedDecisionPresent: boolean;
  persistedStateMatchesDecision: boolean;
  workerStreamContainsOutput: boolean;
  clientStateMatchesServer: boolean;
  visibleStateMatchesClient: boolean;
}): LiveMismatchKind | null {
  if (!args.namedDecisionPresent) return "control_plane_missing_decision";
  if (!args.persistedStateMatchesDecision) return "persistence_finalization_gap";
  if (!args.workerStreamContainsOutput) return "stream_delivery_gap";
  if (!args.clientStateMatchesServer) return "client_state_mismatch";
  if (!args.visibleStateMatchesClient) return "visible_affordance_mismatch";
  return null;
}

export function appendLiveCheckpointDurably(
  reportPath: string,
  checkpoint: LiveCheckpointRecord,
): void {
  const directory = path.dirname(reportPath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const record = redactLiveEvidence(checkpoint);
  const descriptor = fs.openSync(reportPath, "a", 0o600);
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(record)}\n`, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const directoryDescriptor = fs.openSync(directory, "r");
  try {
    fs.fsyncSync(directoryDescriptor);
  } finally {
    fs.closeSync(directoryDescriptor);
  }
}

export function readLiveCheckpointReport(reportPath: string): LiveCheckpointRecord[] {
  if (!fs.existsSync(reportPath)) return [];
  return fs.readFileSync(reportPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LiveCheckpointRecord);
}
