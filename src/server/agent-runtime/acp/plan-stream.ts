import { randomUUID } from "node:crypto";
import type * as acp from "@agentclientprotocol/sdk";
import {
  isAcpCorePlanUpdate,
  measureAcpPlanJsonBytes,
  normalizeAcpCorePlan,
  reduceWorkerPlanEntries,
  MAX_ACP_PLAN_REJECTION_PREVIEW_BYTES,
  type AcpPlanValidationFailure,
  type WorkerPlanReadResponse,
} from "@/shared/acp-plan";
import type { WorkerEntry } from "@/shared/worker-entries";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";
import { appendWorkerEntryWithResult, readWorkerEntriesSince } from "@/server/workers/output-store";

type AppendResult = { entry: WorkerEntry; appended: boolean };
type PlanStreamDependencies = {
  append: (runId: string, workerId: string, entry: Omit<WorkerEntry, "seq">) => Promise<AppendResult>;
  read: (runId: string, workerId: string, afterSeq: number) => Promise<{ entries: WorkerEntry[]; latestSeq: number }>;
  emit: (event: NamedEvent) => unknown;
};

type PlanBinding = {
  sessionId: string | null;
  boundarySeq: number;
  hydrated: boolean;
};

export type PlanStreamResult = {
  kind: "ignored" | "accepted" | "rejected";
  entry: WorkerEntry | null;
  reason?: string;
};

const defaultDependencies: PlanStreamDependencies = {
  append: appendWorkerEntryWithResult,
  read: readWorkerEntriesSince,
  emit: emitNamedEvent,
};

function key(runId: string, workerId: string) {
  return `${runId}/${workerId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function projectionForReason(reason: string): "rejected" | "unsupported" | "stale" {
  if (reason === "unsupported") return "unsupported";
  if (reason === "stale_session") return "stale";
  return "rejected";
}

function rejectionReason(failure: AcpPlanValidationFailure): "malformed" | "oversized" {
  return failure.reason === "update_too_large" ? "oversized" : "malformed";
}

function boundedPreview(update: unknown): { preview: string; hash: string; measuredBytes: number } {
  const serialized = JSON.stringify(update);
  const measuredBytes = new TextEncoder().encode(serialized).byteLength;
  const bytes = new TextEncoder().encode(serialized).slice(0, MAX_ACP_PLAN_REJECTION_PREVIEW_BYTES);
  let preview = new TextDecoder().decode(bytes);
  while (preview.length > 0 && preview.endsWith("\uFFFD")) {
    preview = preview.slice(0, -1);
  }
  // The preview is diagnostic only. Avoid pulling a hashing dependency into
  // the browser-shared contract; a stable length/preview envelope is enough
  // for the existing protocol-debug surface and stays bounded.
  return { preview, hash: `${measuredBytes}:${serialized.length}`, measuredBytes };
}

function latestBoundary(entries: readonly WorkerEntry[]) {
  return entries.reduce<WorkerEntry | null>((latest, entry) => {
    if (entry.planProjection !== "session_reset" || !entry.acpSessionId) return latest;
    return !latest || entry.seq > latest.seq ? entry : latest;
  }, null);
}

function isPlanLikeUpdate(update: unknown): update is acp.SessionUpdate {
  if (!update || typeof update !== "object") return false;
  const sessionUpdate = (update as { sessionUpdate?: unknown }).sessionUpdate;
  return sessionUpdate === "plan" || sessionUpdate === "plan_update" || sessionUpdate === "plan_removed";
}

export function isAcpPlanNotification(update: unknown): update is acp.SessionUpdate {
  return isPlanLikeUpdate(update);
}

export class AcpPlanStream {
  private readonly bindings = new Map<string, PlanBinding>();
  private readonly chains = new Map<string, Promise<void>>();
  private readonly deps: PlanStreamDependencies;

  constructor(deps: Partial<PlanStreamDependencies> = {}) {
    this.deps = { ...defaultDependencies, ...deps };
  }

  private serial<T>(runId: string, workerId: string, task: () => Promise<T>): Promise<T> {
    const operationKey = key(runId, workerId);
    const previous = this.chains.get(operationKey) ?? Promise.resolve();
    const next = previous.then(task);
    const settled = next.then(() => undefined, () => undefined);
    this.chains.set(operationKey, settled);
    return next.finally(() => {
      if (this.chains.get(operationKey) === settled) this.chains.delete(operationKey);
    });
  }

  private publish(event: NamedEvent) {
    try {
      this.deps.emit(event);
    } catch {
      // The durable entry is authoritative. The next cursor wake-up or plan
      // read recovers a client if the synchronous ring publication fails.
    }
  }

  private publishAppend(runId: string, workerId: string, entry: WorkerEntry) {
    if (!entry.seq || !Number.isFinite(entry.seq)) return;
    this.publish({ kind: "worker.entry_appended", runId, workerId, seq: entry.seq });
  }

  private async appendDiagnostic(args: {
    runId: string;
    workerId: string;
    sessionId: string | null;
    update: unknown;
    reason: "unsupported" | "unbound" | "hydrating" | "stale_session" | "missing_session" | "startup_session_mismatch" | "startup_buffer_overflow" | "malformed" | "oversized";
    projection?: "rejected" | "unsupported" | "stale";
  }): Promise<PlanStreamResult> {
    const envelope = boundedPreview(args.update);
    const entry: Omit<WorkerEntry, "seq"> = {
      id: randomUUID(),
      type: args.reason === "unsupported" ? "plan_update" : "system_note",
      text: `ACP plan update rejected: ${args.reason}`,
      timestamp: nowIso(),
      raw: {
        classification: args.reason,
        sessionId: args.sessionId,
        preview: envelope.preview,
        hash: envelope.hash,
        measuredBytes: envelope.measuredBytes,
      },
      acpSessionId: args.sessionId,
      planProjection: args.projection ?? projectionForReason(args.reason),
      diagnosticOnly: true,
    };

    let result: AppendResult;
    try {
      result = await this.deps.append(args.runId, args.workerId, entry);
    } catch (error) {
      this.publish({
        kind: "error.surfaced",
        code: "worker.plan.diagnostic_append_failed",
        message: `Failed to persist a rejected ACP plan update: ${error instanceof Error ? error.message : String(error)}`,
        surface: "log",
        runId: args.runId,
        workerId: args.workerId,
        cause: error instanceof Error ? { name: error.name, message: error.message } : null,
      });
      return { kind: "rejected", entry: null, reason: args.reason };
    }
    if (result.appended) this.publishAppend(args.runId, args.workerId, result.entry);
    this.publish({
      kind: "worker.plan_rejected",
      runId: args.runId,
      workerId: args.workerId,
      reason: args.reason,
      sessionId: args.sessionId,
      seq: result.entry.seq || null,
      measuredBytes: envelope.measuredBytes,
    });
    return { kind: "rejected", entry: result.entry, reason: args.reason };
  }

  async hydrateWorkerPlanBinding(runId: string, workerId: string): Promise<PlanBinding> {
    return this.serial(runId, workerId, async () => {
      const operationKey = key(runId, workerId);
      try {
        const result = await this.deps.read(runId, workerId, 0);
        const boundary = latestBoundary(result.entries);
        const binding = {
          sessionId: boundary?.acpSessionId ?? null,
          boundarySeq: boundary?.seq ?? 0,
          hydrated: true,
        } satisfies PlanBinding;
        this.bindings.set(operationKey, binding);
        return binding;
      } catch (error) {
        this.publish({
          kind: "error.surfaced",
          code: "worker.plan.binding_hydration_failed",
          message: `Failed to hydrate ACP plan session binding: ${error instanceof Error ? error.message : String(error)}`,
          surface: "log",
          runId,
          workerId,
          cause: error instanceof Error ? { name: error.name, message: error.message } : null,
        });
        throw error;
      }
    });
  }

  async beginWorkerPlanSession(runId: string, workerId: string, sessionId: string): Promise<PlanBinding> {
    return this.serial(runId, workerId, async () => {
      const operationKey = key(runId, workerId);
      const current = this.bindings.get(operationKey);
      if (current?.hydrated && current.sessionId === sessionId && current.boundarySeq > 0) {
        return current;
      }

      const entry: Omit<WorkerEntry, "seq"> = {
        id: randomUUID(),
        type: "system_note",
        text: "",
        timestamp: nowIso(),
        raw: { kind: "acp.plan_session_boundary" },
        acpSessionId: sessionId,
        planProjection: "session_reset",
        diagnosticOnly: true,
      };
      let result: AppendResult;
      try {
        result = await this.deps.append(runId, workerId, entry);
      } catch (error) {
        this.publish({
          kind: "error.surfaced",
          code: "worker.plan.boundary_append_failed",
          message: `Failed to persist the ACP plan session boundary: ${error instanceof Error ? error.message : String(error)}`,
          surface: "log",
          runId,
          workerId,
          cause: error instanceof Error ? { name: error.name, message: error.message } : null,
        });
        throw error;
      }
      const boundarySeq = result.entry.seq;
      const binding = { sessionId, boundarySeq, hydrated: true } satisfies PlanBinding;
      this.bindings.set(operationKey, binding);
      if (result.appended) this.publishAppend(runId, workerId, result.entry);
      this.publish({ kind: "worker.plan_boundary_started", runId, workerId, seq: boundarySeq, acpSessionId: sessionId });
      return binding;
    });
  }

  async handleAcpSessionUpdate(args: {
    runId: string;
    workerId: string;
    sessionId: string | null | undefined;
    update: unknown;
  }): Promise<PlanStreamResult> {
    if (!isPlanLikeUpdate(args.update)) return { kind: "ignored", entry: null };

    return this.serial(args.runId, args.workerId, async () => {
      const sessionId = typeof args.sessionId === "string" && args.sessionId.trim() ? args.sessionId.trim() : null;
      const current = this.bindings.get(key(args.runId, args.workerId));
      if (!sessionId) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "missing_session" });
      }
      if (!current) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "unbound" });
      }
      if (!current.hydrated) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "hydrating" });
      }
      if (current.sessionId !== sessionId) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "stale_session", projection: "stale" });
      }

      if (!isAcpCorePlanUpdate(args.update)) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "unsupported", projection: "unsupported" });
      }

      const normalized = normalizeAcpCorePlan(args.update);
      if (!normalized.ok) {
        const reason = rejectionReason(normalized);
        return this.appendDiagnostic({ ...args, sessionId, reason });
      }

      const entry: Omit<WorkerEntry, "seq"> = {
        id: randomUUID(),
        type: "plan",
        text: normalized.items.map((item) => item.content).join("\n"),
        timestamp: nowIso(),
        raw: args.update,
        acpSessionId: sessionId,
        planProjection: "accepted_core",
        normalizedPlan: normalized.items,
      };
      if (measureAcpPlanJsonBytes(entry) > 64 * 1024) {
        return this.appendDiagnostic({ ...args, sessionId, reason: "oversized" });
      }

      let result: AppendResult;
      try {
        result = await this.deps.append(args.runId, args.workerId, entry);
      } catch (error) {
        this.publish({
          kind: "error.surfaced",
          code: "worker.plan.append_failed",
          message: `Failed to persist an accepted ACP plan update: ${error instanceof Error ? error.message : String(error)}`,
          surface: "log",
          runId: args.runId,
          workerId: args.workerId,
          cause: error instanceof Error ? { name: error.name, message: error.message } : null,
        });
        return { kind: "rejected", entry: null, reason: "append_failed" };
      }
      if (result.appended) this.publishAppend(args.runId, args.workerId, result.entry);
      this.publish({ kind: "worker.plan_updated", runId: args.runId, workerId: args.workerId, seq: result.entry.seq, acpSessionId: sessionId });
      return { kind: "accepted", entry: result.entry };
    });
  }

  async readWorkerPlan(runId: string, workerId: string): Promise<WorkerPlanReadResponse> {
    const result = await this.deps.read(runId, workerId, 0);
    return {
      plan: reduceWorkerPlanEntries(result.entries, runId, workerId),
      latestSeq: result.latestSeq,
    };
  }

  clear(runId: string, workerId: string) {
    const operationKey = key(runId, workerId);
    this.bindings.delete(operationKey);
    this.chains.delete(operationKey);
  }
}

export const acpPlanStream = new AcpPlanStream();

export const hydrateWorkerPlanBinding = acpPlanStream.hydrateWorkerPlanBinding.bind(acpPlanStream);
export const beginWorkerPlanSession = acpPlanStream.beginWorkerPlanSession.bind(acpPlanStream);
export const handleAcpSessionUpdate = acpPlanStream.handleAcpSessionUpdate.bind(acpPlanStream);
export const readWorkerPlan = acpPlanStream.readWorkerPlan.bind(acpPlanStream);

async function resolveRunIdForWorker(workerId: string): Promise<string | null> {
  const [{ eq }, { db }, { workers }] = await Promise.all([
    import("drizzle-orm"),
    import("@/server/db"),
    import("@/server/db/schema"),
  ]);
  const worker = await db.select({ runId: workers.runId }).from(workers).where(eq(workers.id, workerId)).get();
  return worker?.runId ?? null;
}

export async function initializeWorkerPlanSession(workerId: string, sessionId: string): Promise<string | null> {
  const runId = await resolveRunIdForWorker(workerId);
  if (!runId) return null;
  await hydrateWorkerPlanBinding(runId, workerId);
  await beginWorkerPlanSession(runId, workerId, sessionId);
  return runId;
}

export async function handleAcpSessionUpdateForWorker(args: {
  workerId: string;
  sessionId: string | null | undefined;
  update: unknown;
}): Promise<PlanStreamResult> {
  const runId = await resolveRunIdForWorker(args.workerId);
  if (!runId) return { kind: "ignored", entry: null, reason: "worker_not_persisted" };
  return handleAcpSessionUpdate({ ...args, runId });
}
