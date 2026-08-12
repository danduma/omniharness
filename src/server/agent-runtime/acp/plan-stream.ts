import { createHash, randomUUID } from "node:crypto";
import type * as acp from "@agentclientprotocol/sdk";
import {
  MAX_ACP_PLAN_BYTES,
  MAX_ACP_PLAN_REJECTION_PREVIEW_BYTES,
  MAX_ACP_PLAN_SESSION_ID_BYTES,
  type AcpPlanValidationFailure,
  type WorkerPlanReadResponse,
} from "@/shared/acp-plan";
import {
  classifyAcpPlanUpdate,
  measureAcpPlanJsonBytes,
  normalizeAcpCorePlan,
  reduceWorkerPlanEntries,
} from "./plan-state";
import type { WorkerEntry } from "@/shared/worker-entries";
import { emitNamedEvent, type NamedEvent } from "@/server/events/named-events";
import {
  appendWorkerEntryWithResult,
  readLatestWorkerPlanEntries,
  readWorkerEntriesSince,
} from "@/server/workers/output-store";
import { handleAcpGoalSessionUpdateForWorker } from "./goal-state";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";

type AppendResult = { entry: WorkerEntry; appended: boolean };
type PlanStreamDependencies = {
  append: (runId: string, workerId: string, entry: Omit<WorkerEntry, "seq">) => Promise<AppendResult>;
  read: (runId: string, workerId: string, afterSeq: number) => Promise<{ entries: WorkerEntry[]; latestSeq: number }>;
  readPlan: (runId: string, workerId: string) => Promise<{ entries: WorkerEntry[]; latestSeq: number }>;
  emit: (event: NamedEvent) => unknown;
  createId: () => string;
};

type PlanBinding = {
  sessionId: string | null;
  boundarySeq: number;
  hydrated: boolean;
};

export type WorkerPlanStartupContext = {
  runId: string;
  workerId: string;
  connectionGeneration: number;
  expectedSessionId: string | null;
};

type StartupBufferedCommand = {
  sessionId: string | null;
  update: unknown;
  forcedReason?: "hydrating" | "oversized";
  measuredBytes?: number;
};

type StartupState = {
  context: WorkerPlanStartupContext;
  phase: "starting" | "hydrating";
  commands: StartupBufferedCommand[];
  overflowCount: number;
};

export type PlanStreamResult = {
  kind: "ignored" | "accepted" | "rejected";
  entry: WorkerEntry | null;
  reason?: string;
};

const defaultDependencies: PlanStreamDependencies = {
  append: appendWorkerEntryWithResult,
  read: readWorkerEntriesSince,
  readPlan: readLatestWorkerPlanEntries,
  emit: emitNamedEvent,
  createId: randomUUID,
};

const MAX_STARTUP_PLAN_UPDATES = 16;

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
  const serialized = JSON.stringify(update) ?? "undefined";
  const measuredBytes = new TextEncoder().encode(serialized).byteLength;
  const bytes = new TextEncoder().encode(serialized).slice(0, MAX_ACP_PLAN_REJECTION_PREVIEW_BYTES);
  let preview = new TextDecoder().decode(bytes);
  while (preview.length > 0 && preview.endsWith("\uFFFD")) {
    preview = preview.slice(0, -1);
  }
  return {
    preview,
    hash: createHash("sha256").update(serialized).digest("hex"),
    measuredBytes,
  };
}

type CapturedPlanSessionId =
  | { kind: "valid"; value: string; measuredBytes: number }
  | { kind: "missing"; measuredBytes: number }
  | { kind: "oversized"; measuredBytes: number };

function capturePlanSessionId(value: unknown): CapturedPlanSessionId {
  if (typeof value !== "string") return { kind: "missing", measuredBytes: 0 };
  const measuredBytes = new TextEncoder().encode(value).byteLength;
  if (measuredBytes > MAX_ACP_PLAN_SESSION_ID_BYTES) {
    return { kind: "oversized", measuredBytes };
  }
  const trimmed = value.trim();
  if (!trimmed) return { kind: "missing", measuredBytes };
  return { kind: "valid", value: trimmed, measuredBytes };
}

function oversizedSessionEvidence(value: unknown) {
  const evidence = boundedPreview(value);
  return {
    classification: "oversized_session_id",
    preview: evidence.preview,
    hash: evidence.hash,
    measuredBytes: evidence.measuredBytes,
  };
}

function latestBoundary(entries: readonly WorkerEntry[]) {
  return entries.reduce<WorkerEntry | null>((latest, entry) => {
    if (entry.planProjection !== "session_reset" || !entry.acpSessionId) return latest;
    return !latest || entry.seq > latest.seq ? entry : latest;
  }, null);
}

function isPlanLikeUpdate(update: unknown): update is acp.SessionUpdate {
  return classifyAcpPlanUpdate(update) !== "not_plan";
}

export function isAcpPlanNotification(update: unknown): update is acp.SessionUpdate {
  return isPlanLikeUpdate(update);
}

export class AcpPlanStream {
  private readonly bindings = new Map<string, PlanBinding>();
  private readonly chains = new Map<string, Promise<void>>();
  private readonly startupStates = new Map<string, StartupState>();
  private nextConnectionGeneration = 0;
  private readonly deps: PlanStreamDependencies;

  constructor(deps: Partial<PlanStreamDependencies> = {}) {
    this.deps = { ...defaultDependencies, ...deps };
    if (deps.read && !deps.readPlan) this.deps.readPlan = (runId, workerId) => deps.read!(runId, workerId, 0);
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

  private publish(event: NamedEvent, subjects?: { runId: string; workerId: string }) {
    try {
      this.deps.emit(event);
    } catch (error) {
      // The durable entry is authoritative. The next cursor wake-up or plan
      // read recovers a client if the synchronous ring publication fails.
      if (event.kind === "error.surfaced" || !subjects) return;
      try {
        this.deps.emit({
          kind: "error.surfaced",
          code: "worker.plan.event_publish_failed",
          message: `Failed to publish an ACP plan event: ${error instanceof Error ? error.message : String(error)}`,
          surface: "log",
          runId: subjects.runId,
          workerId: subjects.workerId,
          cause: error instanceof Error ? { name: error.name, message: error.message } : null,
        });
      } catch {
        // The same failing publication boundary cannot report itself. Durable
        // stream truth and periodic snapshot validation remain authoritative.
      }
    }
  }

  private publishAppend(runId: string, workerId: string, entry: WorkerEntry) {
    if (!entry.seq || !Number.isFinite(entry.seq)) return;
    this.publish({ kind: "worker.entry_appended", runId, workerId, seq: entry.seq }, { runId, workerId });
  }

  private async appendDiagnostic(args: {
    runId: string;
    workerId: string;
    sessionId: string | null;
    update: unknown;
    reason: "unsupported" | "unbound" | "hydrating" | "stale_session" | "missing_session" | "startup_session_mismatch" | "startup_buffer_overflow" | "malformed" | "oversized";
    projection?: "rejected" | "unsupported" | "stale";
    measuredBytes?: number;
  }): Promise<PlanStreamResult> {
    const envelope = boundedPreview(args.update);
    const measuredBytes = args.measuredBytes ?? envelope.measuredBytes;
    const entry: Omit<WorkerEntry, "seq"> = {
      id: `acp-plan-diagnostic-${createHash("sha256")
        .update(`${args.sessionId ?? "missing"}\0${args.reason}\0${envelope.hash}`)
        .digest("hex")}`,
      type: args.reason === "unsupported" ? "plan_update" : "system_note",
      text: `ACP plan update rejected: ${args.reason}`,
      timestamp: nowIso(),
      raw: {
        classification: args.reason,
        sessionId: args.sessionId,
        preview: envelope.preview,
        hash: envelope.hash,
        measuredBytes,
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
    if (result.appended) {
      this.publishAppend(args.runId, args.workerId, result.entry);
      this.publish({
        kind: "worker.plan_rejected",
        runId: args.runId,
        workerId: args.workerId,
        reason: args.reason,
        sessionId: args.sessionId,
        seq: result.entry.seq || null,
        measuredBytes,
      }, { runId: args.runId, workerId: args.workerId });
    }
    return { kind: "rejected", entry: result.entry, reason: args.reason };
  }

  beginWorkerPlanStartup(
    runId: string,
    workerId: string,
    expectedSessionId: string | null,
  ): WorkerPlanStartupContext {
    const context: WorkerPlanStartupContext = {
      runId,
      workerId,
      connectionGeneration: ++this.nextConnectionGeneration,
      expectedSessionId,
    };
    this.startupStates.set(key(runId, workerId), {
      context,
      phase: "starting",
      commands: [],
      overflowCount: 0,
    });
    return context;
  }

  bufferWorkerPlanStartupUpdate(
    context: WorkerPlanStartupContext,
    command: { sessionId: string | null | undefined; update: unknown },
  ): "buffered" | "ignored" | "stale_generation" | "overflow" {
    if (!isPlanLikeUpdate(command.update)) return "ignored";
    const state = this.startupStates.get(key(context.runId, context.workerId));
    if (!state || state.context.connectionGeneration !== context.connectionGeneration) {
      return "stale_generation";
    }
    if (state.commands.length >= MAX_STARTUP_PLAN_UPDATES) {
      state.overflowCount += 1;
      return "overflow";
    }

    const capturedSessionId = capturePlanSessionId(command.sessionId);
    if (capturedSessionId.kind === "oversized") {
      state.commands.push({
        sessionId: null,
        update: oversizedSessionEvidence(command.sessionId),
        forcedReason: "oversized",
        measuredBytes: capturedSessionId.measuredBytes,
      });
      return "buffered";
    }
    const sessionId = capturedSessionId.kind === "valid" ? capturedSessionId.value : null;
    const envelope = boundedPreview(command.update);
    if (envelope.measuredBytes > MAX_ACP_PLAN_BYTES) {
      state.commands.push({
        sessionId,
        update: {
          classification: "oversized_startup_plan",
          preview: envelope.preview,
          hash: envelope.hash,
          measuredBytes: envelope.measuredBytes,
        },
        forcedReason: "oversized",
        measuredBytes: envelope.measuredBytes,
      });
      return "buffered";
    }

    const captured = JSON.parse(JSON.stringify(command.update)) as unknown;
    state.commands.push({
      sessionId,
      update: captured,
      ...(state.phase === "hydrating" ? { forcedReason: "hydrating" as const } : {}),
    });
    return "buffered";
  }

  async completeWorkerPlanStartup(
    context: WorkerPlanStartupContext,
    authoritativeSessionId: string,
  ): Promise<void> {
    const operationKey = key(context.runId, context.workerId);
    const state = this.startupStates.get(operationKey);
    if (!state || state.context.connectionGeneration !== context.connectionGeneration) return;
    state.phase = "hydrating";
    try {
      await this.hydrateWorkerPlanBinding(context.runId, context.workerId);
      await this.beginWorkerPlanSession(context.runId, context.workerId, authoritativeSessionId);

      while (true) {
        const commands = state.commands.splice(0);
        for (const command of commands) {
          if (command.forcedReason) {
            await this.appendDiagnostic({
              runId: context.runId,
              workerId: context.workerId,
              sessionId: command.sessionId,
              update: command.update,
              reason: command.forcedReason,
              measuredBytes: command.measuredBytes,
            });
          } else if (!command.sessionId) {
            await this.appendDiagnostic({
              runId: context.runId,
              workerId: context.workerId,
              sessionId: null,
              update: command.update,
              reason: "missing_session",
            });
          } else if (command.sessionId !== authoritativeSessionId) {
            await this.appendDiagnostic({
              runId: context.runId,
              workerId: context.workerId,
              sessionId: command.sessionId,
              update: command.update,
              reason: "startup_session_mismatch",
            });
          } else {
            await this.handleAcpSessionUpdate({
              runId: context.runId,
              workerId: context.workerId,
              sessionId: command.sessionId,
              update: command.update,
            });
          }
        }

        if (state.overflowCount > 0) {
          const droppedCount = state.overflowCount;
          state.overflowCount = 0;
          await this.appendDiagnostic({
            runId: context.runId,
            workerId: context.workerId,
            sessionId: authoritativeSessionId,
            update: { classification: "startup_buffer_overflow", droppedCount },
            reason: "startup_buffer_overflow",
          });
        }

        if (state.commands.length === 0 && state.overflowCount === 0) {
          this.startupStates.delete(operationKey);
          return;
        }
      }
    } catch (error) {
      this.startupStates.delete(operationKey);
      throw error;
    }
  }

  abortWorkerPlanStartup(context: WorkerPlanStartupContext): void {
    const operationKey = key(context.runId, context.workerId);
    const state = this.startupStates.get(operationKey);
    if (state?.context.connectionGeneration === context.connectionGeneration) {
      this.startupStates.delete(operationKey);
    }
  }

  async hydrateWorkerPlanBinding(runId: string, workerId: string): Promise<PlanBinding> {
    return this.serial(runId, workerId, async () => {
      const operationKey = key(runId, workerId);
      try {
        const result = await this.deps.readPlan(runId, workerId);
        const boundary = latestBoundary(result.entries);
        const binding = {
          sessionId: boundary?.acpSessionId ?? null,
          boundarySeq: boundary?.seq ?? 0,
          hydrated: true,
        } satisfies PlanBinding;
        this.bindings.set(operationKey, binding);
        return binding;
      } catch (error) {
        // Fail closed. A previously hydrated session must not remain usable
        // after a later lifecycle generation failed to re-establish durable
        // truth; subsequent callbacks are rejected as hydrating until a
        // successful hydration replaces this sentinel.
        this.bindings.set(operationKey, {
          sessionId: null,
          boundarySeq: 0,
          hydrated: false,
        });
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
      const capturedSessionId = capturePlanSessionId(sessionId);
      if (capturedSessionId.kind !== "valid") {
        const message = capturedSessionId.kind === "oversized"
          ? `ACP plan session id exceeds ${MAX_ACP_PLAN_SESSION_ID_BYTES} bytes.`
          : "ACP plan session id is missing.";
        const error = new Error(message);
        this.publish({
          kind: "error.surfaced",
          code: "worker.plan.boundary_append_failed",
          message,
          surface: "log",
          runId,
          workerId,
          cause: { name: error.name, message: error.message },
        });
        throw error;
      }
      const normalizedSessionId = capturedSessionId.value;
      const operationKey = key(runId, workerId);
      const current = this.bindings.get(operationKey);
      if (current?.hydrated && current.sessionId === normalizedSessionId && current.boundarySeq > 0) {
        return current;
      }

      const entry: Omit<WorkerEntry, "seq"> = {
        id: `acp-plan-boundary-${this.deps.createId()}`,
        type: "system_note",
        text: "",
        timestamp: nowIso(),
        raw: { kind: "acp.plan_session_boundary" },
        acpSessionId: normalizedSessionId,
        planProjection: "session_reset",
        diagnosticOnly: true,
      };
      const maximumSeq = Number.MAX_SAFE_INTEGER;
      const durableCandidate = { ...entry, seq: maximumSeq } satisfies WorkerEntry;
      const responseCandidate: WorkerPlanReadResponse = {
        latestSeq: maximumSeq,
        plan: {
          runId,
          workerId,
          acpSessionId: normalizedSessionId,
          planBoundarySeq: maximumSeq,
          lastEntrySeq: maximumSeq,
          lastAcceptedEntryId: null,
          visible: false,
          items: [],
          updatedAt: entry.timestamp,
        },
      };
      if (
        measureAcpPlanJsonBytes(durableCandidate) > MAX_ACP_PLAN_BYTES
        || measureAcpPlanJsonBytes(responseCandidate) > MAX_ACP_PLAN_BYTES
      ) {
        const error = new Error(`ACP plan session boundary exceeds ${MAX_ACP_PLAN_BYTES} bytes.`);
        this.publish({
          kind: "error.surfaced",
          code: "worker.plan.boundary_append_failed",
          message: error.message,
          surface: "log",
          runId,
          workerId,
          cause: { name: error.name, message: error.message },
        });
        throw error;
      }
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
      const binding = { sessionId: normalizedSessionId, boundarySeq, hydrated: true } satisfies PlanBinding;
      this.bindings.set(operationKey, binding);
      if (result.appended) this.publishAppend(runId, workerId, result.entry);
      if (result.appended) {
        this.publish({ kind: "worker.plan_boundary_started", runId, workerId, seq: boundarySeq }, { runId, workerId });
      }
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
      const capturedSessionId = capturePlanSessionId(args.sessionId);
      if (capturedSessionId.kind === "oversized") {
        return this.appendDiagnostic({
          runId: args.runId,
          workerId: args.workerId,
          sessionId: null,
          update: oversizedSessionEvidence(args.sessionId),
          reason: "oversized",
          measuredBytes: capturedSessionId.measuredBytes,
        });
      }
      const sessionId = capturedSessionId.kind === "valid" ? capturedSessionId.value : null;
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

      // The canonical run goal and the worker's append-only conversation
      // projection consume the same ACP plan notification independently. The
      // goal handler writes only control-plane state; this stream remains the
      // sole persistence path for worker-visible plan content.
      try {
        await handleAcpGoalSessionUpdateForWorker({
          workerId: args.workerId,
          sessionId,
          update: args.update,
        });
      } catch (error) {
        const message = redactGoalErrorMessage(error);
        this.publish({
          kind: "error.surfaced",
          code: "goal.reconciliation.failed",
          message: `Failed to project an ACP plan into goal control: ${message}`,
          surface: "log",
          runId: args.runId,
          workerId: args.workerId,
          cause: error instanceof Error ? { name: error.name, message } : null,
        });
      }

      if (classifyAcpPlanUpdate(args.update) !== "core") {
        return this.appendDiagnostic({ ...args, sessionId, reason: "unsupported", projection: "unsupported" });
      }

      const normalized = normalizeAcpCorePlan(args.update);
      if (!normalized.ok) {
        const reason = rejectionReason(normalized);
        return this.appendDiagnostic({ ...args, sessionId, reason });
      }

      const entry: Omit<WorkerEntry, "seq"> = {
        id: `acp-plan-${this.deps.createId()}`,
        type: "plan",
        text: normalized.items.map((item) => item.content).join("\n"),
        timestamp: nowIso(),
        raw: args.update,
        acpSessionId: sessionId,
        planProjection: "accepted_core",
        normalizedPlan: normalized.items,
      };
      const maximumSeq = Number.MAX_SAFE_INTEGER;
      const durableCandidate = { ...entry, seq: maximumSeq } satisfies WorkerEntry;
      const responseCandidate: WorkerPlanReadResponse = {
        latestSeq: maximumSeq,
        plan: {
          runId: args.runId,
          workerId: args.workerId,
          acpSessionId: sessionId,
          planBoundarySeq: current.boundarySeq,
          lastEntrySeq: maximumSeq,
          lastAcceptedEntryId: entry.id,
          visible: true,
          items: normalized.items.map((item, order) => ({
            ...item,
            id: `${current.boundarySeq}:${order}`,
            order,
          })),
          updatedAt: entry.timestamp,
        },
      };
      if (
        measureAcpPlanJsonBytes(durableCandidate) > MAX_ACP_PLAN_BYTES
        || measureAcpPlanJsonBytes(responseCandidate) > MAX_ACP_PLAN_BYTES
      ) {
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
      if (result.appended) {
        this.publish({
          kind: "worker.plan_updated",
          runId: args.runId,
          workerId: args.workerId,
          seq: result.entry.seq,
        }, { runId: args.runId, workerId: args.workerId });
      }
      return { kind: "accepted", entry: result.entry };
    });
  }

  async readWorkerPlan(runId: string, workerId: string): Promise<WorkerPlanReadResponse> {
    const result = await this.deps.readPlan(runId, workerId);
    const response = {
      plan: reduceWorkerPlanEntries(result.entries, runId, workerId),
      latestSeq: result.latestSeq,
    };
    if (measureAcpPlanJsonBytes(response) > MAX_ACP_PLAN_BYTES) {
      throw new Error(`ACP plan snapshot exceeds ${MAX_ACP_PLAN_BYTES} bytes`);
    }
    return response;
  }

  clear(runId: string, workerId: string) {
    const operationKey = key(runId, workerId);
    this.bindings.delete(operationKey);
    this.chains.delete(operationKey);
    this.startupStates.delete(operationKey);
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

export async function createWorkerPlanStartupContext(
  workerId: string,
  expectedSessionId: string | null,
): Promise<WorkerPlanStartupContext | null> {
  const runId = await resolveRunIdForWorker(workerId);
  if (!runId) return null;
  return acpPlanStream.beginWorkerPlanStartup(runId, workerId, expectedSessionId);
}

export function bufferWorkerPlanStartupUpdate(
  context: WorkerPlanStartupContext,
  command: { sessionId: string | null | undefined; update: unknown },
) {
  return acpPlanStream.bufferWorkerPlanStartupUpdate(context, command);
}

export async function completeWorkerPlanStartup(
  context: WorkerPlanStartupContext,
  authoritativeSessionId: string,
) {
  await acpPlanStream.completeWorkerPlanStartup(context, authoritativeSessionId);
}

export function abortWorkerPlanStartup(context: WorkerPlanStartupContext) {
  acpPlanStream.abortWorkerPlanStartup(context);
}

export async function handleAcpSessionUpdateForWorker(args: {
  workerId: string;
  sessionId: string | null | undefined;
  update: unknown;
}): Promise<PlanStreamResult> {
  const runId = await resolveRunIdForWorker(args.workerId);
  if (!runId) return { kind: "rejected", entry: null, reason: "worker_not_persisted" };
  return handleAcpSessionUpdate({ ...args, runId });
}
