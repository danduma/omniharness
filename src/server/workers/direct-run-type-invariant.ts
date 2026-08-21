import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs, workers } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { normalizeWorkerType } from "@/server/supervisor/worker-types";

export class DirectRunHandoffRequiredError extends Error {
  readonly code = "handoff_required";
  readonly surfacedCode = "handoff.fork_required";
  readonly status = 409;

  constructor(readonly runId: string, readonly currentWorkerType: string, readonly requestedWorkerType: string) {
    super(`Changing the CLI from ${currentWorkerType} to ${requestedWorkerType} requires a new handoff session.`);
    this.name = "DirectRunHandoffRequiredError";
  }
}

type RefusalEvent = {
  kind: "handoff.refused";
  runId: string;
  stage: "worker_insert";
  code: string;
  reason: string;
};

export function assertDirectRunWorkerTypeInvariant(args: {
  run: { id: string; sessionType: string | null; mode: string | null };
  existingWorkerTypes: string[];
  requestedWorkerType: string;
  emit?: (event: RefusalEvent) => unknown;
}): void {
  if (args.run.sessionType !== "omni" || (args.run.mode !== "direct" && args.run.mode !== "commit")) return;
  const requested = normalizeWorkerType(args.requestedWorkerType);
  const current = args.existingWorkerTypes.map(normalizeWorkerType).find((workerType) => workerType !== requested);
  if (!current) return;
  const error = new DirectRunHandoffRequiredError(args.run.id, current, requested);
  (args.emit ?? emitNamedEvent)({
    kind: "handoff.refused",
    runId: args.run.id,
    stage: "worker_insert",
    code: error.code,
    reason: error.message,
  });
  throw error;
}

export async function assertDirectRunWorkerTypeForInsert(runId: string, requestedWorkerType: string): Promise<void> {
  const [run, existing] = await Promise.all([
    db.select({ id: runs.id, sessionType: runs.sessionType, mode: runs.mode }).from(runs).where(eq(runs.id, runId)).get(),
    db.select({ type: workers.type }).from(workers).where(eq(workers.runId, runId)),
  ]);
  if (!run) return;
  assertDirectRunWorkerTypeInvariant({
    run,
    existingWorkerTypes: existing.map((worker) => worker.type),
    requestedWorkerType,
  });
}

export function isDirectRunHandoffTriggerError(error: unknown): boolean {
  return error instanceof DirectRunHandoffRequiredError
    || (error instanceof Error && /HANDOFF_REQUIRED/.test(error.message));
}
