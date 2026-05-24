/**
 * Watchdog for direct-mode workers that get stuck in `status='working'`
 * but never emit anything to the worker stream after a user message.
 *
 * Root cause this addresses: the ACP roundtrip for a prompt can silently
 * drop — gemini/codex/claude receives "continue" but never produces a
 * response, the agent runtime never notices, and the worker sits at
 * state='working' indefinitely. Nothing in the existing supervisor
 * watchdog checks for this because it only inspects implementation
 * runs.
 *
 * Recovery contract: if a direct worker is working but has produced no
 * stream entries for OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS (default 5
 * minutes), cancel the hung agent, spawn a fresh one via the same
 * resume-or-recreate primitive that on-send recovery uses, and
 * re-deliver the last user message that has no follow-up response. The
 * user sees activity resume on its own.
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, workers } from "@/server/db/schema";
import { askAgent, cancelAgent } from "@/server/bridge-client";
import { readWorkerOutputEntries } from "@/server/workers/output-store";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { resumeMissingDirectWorker } from "@/server/conversations/send-message";
import { recordExecutionEvent } from "@/server/events/execution-event-store";

const DEFAULT_STUCK_TIMEOUT_MS = 5 * 60_000;
const DIRECT_MODE_NAMES = ["direct"];
const STUCK_CANDIDATE_STATUSES = new Set(["working", "starting"]);

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? "").trim().toLowerCase().split(":")[0] ?? "";
}

type ReaperOutcome =
  | { ok: true; recovered: number; skipped: number }
  | { ok: false; error: string };

/**
 * Scan direct-mode workers for stuckness and recover them. Returns counts;
 * never throws. Safe to call repeatedly from the watchdog sweep.
 */
export async function reapStuckDirectWorkers(now: Date = new Date()): Promise<ReaperOutcome> {
  try {
    const timeoutMs = readPositiveIntegerEnv("OMNIHARNESS_WORKER_STUCK_TIMEOUT_MS", DEFAULT_STUCK_TIMEOUT_MS);
    const nowMs = now.getTime();

    const candidates = await db
      .select()
      .from(workers)
      .innerJoin(runs, eq(workers.runId, runs.id))
      .where(inArray(runs.mode, DIRECT_MODE_NAMES));

    let recovered = 0;
    let skipped = 0;

    for (const row of candidates) {
      const worker = row.workers;
      const run = row.runs;
      if (!STUCK_CANDIDATE_STATUSES.has(normalizeStatus(worker.status))) {
        skipped++;
        continue;
      }

      const entries = await readWorkerOutputEntries(worker.runId, worker.id);
      if (entries.length === 0) {
        skipped++;
        continue;
      }

      let lastEntryTs = -1;
      let lastUserInputId: string | null = null;
      let lastUserInputTs = -1;
      for (const entry of entries) {
        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : NaN;
        if (Number.isFinite(ts) && ts > lastEntryTs) lastEntryTs = ts;
        const type = (entry as { type?: string }).type;
        if (type === "user_input") {
          lastUserInputId = entry.id;
          lastUserInputTs = Number.isFinite(ts) ? ts : lastUserInputTs;
        }
      }

      if (lastEntryTs < 0) {
        skipped++;
        continue;
      }
      const idleMs = nowMs - lastEntryTs;
      if (idleMs < timeoutMs) {
        skipped++;
        continue;
      }

      // Always redeliver the last user message if one exists. Trying to infer
      // "did the worker respond" from stream contents is fragile: entries can
      // arrive in seq order but with earlier timestamps if the worker buffered
      // output from a prior turn before the user_input was written. A duplicate
      // response is recoverable; a lost user prompt is not.
      const shouldRedeliver = Boolean(lastUserInputId);
      process.stderr.write(
        `[stuck-reaper] worker ${worker.id} idle for ${Math.round(idleMs / 1000)}s; recovering` +
        ` (will redeliver: ${shouldRedeliver})\n`,
      );

      try {
        await cancelAgent(worker.id);
      } catch {
        // ignore — agent may already be gone
      }

      await db.update(workers).set({
        status: "stuck",
        updatedAt: new Date(),
      }).where(eq(workers.id, worker.id));
      notifyEventStreamSubscribers();

      try {
        await resumeMissingDirectWorker(run, worker);
      } catch (error) {
        await db.update(workers).set({
          status: "error",
          updatedAt: new Date(),
        }).where(eq(workers.id, worker.id));
        await recordExecutionEvent({
          runId: worker.runId,
          workerId: worker.id,
          planItemId: null,
          eventType: "worker_session_recreated",
          details: {
            summary: `Stuck-worker recovery failed to respawn ${worker.id}`,
            error: error instanceof Error ? error.message : String(error),
          },
        });
        notifyEventStreamSubscribers();
        continue;
      }

      void lastUserInputTs;
      if (shouldRedeliver && lastUserInputId) {
        const userMessage = await db
          .select()
          .from(messages)
          .where(eq(messages.id, lastUserInputId))
          .get();
        const content = userMessage?.content?.trim();
        if (content) {
          try {
            await askAgent(worker.id, content);
            recovered++;
            await recordExecutionEvent({
              runId: worker.runId,
              workerId: worker.id,
              planItemId: null,
              eventType: "worker_session_recreated",
              details: {
                summary: `Stuck worker ${worker.id} auto-recovered; last user message re-delivered.`,
                idleSeconds: Math.round(idleMs / 1000),
                redeliveredMessageId: lastUserInputId,
              },
            });
            notifyEventStreamSubscribers();
            continue;
          } catch (error) {
            await db.update(workers).set({
              status: "error",
              updatedAt: new Date(),
            }).where(eq(workers.id, worker.id));
            await recordExecutionEvent({
              runId: worker.runId,
              workerId: worker.id,
              planItemId: null,
              eventType: "worker_session_recreated",
              details: {
                summary: `Stuck-worker recovery: redelivery failed for ${worker.id}`,
                error: error instanceof Error ? error.message : String(error),
              },
            });
            notifyEventStreamSubscribers();
            continue;
          }
        }
      }

      recovered++;
    }

    return { ok: true, recovered, skipped };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
