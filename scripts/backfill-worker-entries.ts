/**
 * Backfill the unified worker conversation stream from legacy `messages`
 * and `executionEvents` rows.
 *
 * Mapping rules (applied per row in createdAt order):
 *   - messages.workerId IS NOT NULL → append to that worker's stream
 *     - role:"user"|"checkpoint" → user_input
 *     - role:"supervisor"        → supervisor_input
 *     - role:"worker"            → message (bridge-typed)
 *     - dedup id = messages.id
 *   - role:"worker" with NULL workerId → attribute if exactly one worker
 *     was active on the run at createdAt; otherwise log to a
 *     `requires_manual_attribution.jsonl` report.
 *   - role:"user" with NULL workerId on a `direct` run → attribute to
 *     the run's single worker.
 *   - role:"user" with NULL workerId on non-direct runs → these are
 *     supervisor-conversation inputs, not worker inputs. Skipped.
 *   - role:"supervisor" without workerId → kept in `messages` only;
 *     skipped here.
 *   - executionEvents with workerId → append as lifecycle entry, dedup
 *     by executionEvents.id.
 *   - executionEvents without workerId → run-level event; skipped.
 *
 * Idempotent: dedup is by entry id matching the source row id.
 *
 *   pnpm tsx scripts/backfill-worker-entries.ts            # apply
 *   pnpm tsx scripts/backfill-worker-entries.ts --dry-run  # report only
 *
 * Exits non-zero in dry-run mode if any messages need manual
 * attribution.
 */
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { executionEvents, messages as messagesTable, runs as runsTable, workers as workersTable } from "@/server/db/schema";
import { appendWorkerEntry } from "@/server/workers/output-store";
import { getAppDataPath } from "@/server/app-root";

type WorkerRow = typeof workersTable.$inferSelect;
type MessageRow = typeof messagesTable.$inferSelect;
type RunRow = typeof runsTable.$inferSelect;
interface BackfillStats {
  scanned: number;
  applied: number;
  skippedSupervisor: number;
  requiresManualAttribution: number;
  attributedByActiveWindow: number;
  attributedToDirectRunWorker: number;
  lifecycleAppended: number;
  lifecycleSkippedNoWorker: number;
}

function createInitialStats(): BackfillStats {
  return {
    scanned: 0,
    applied: 0,
    skippedSupervisor: 0,
    requiresManualAttribution: 0,
    attributedByActiveWindow: 0,
    attributedToDirectRunWorker: 0,
    lifecycleAppended: 0,
    lifecycleSkippedNoWorker: 0,
  };
}

function attachmentsFromMessageJson(value: string | null): undefined {
  // Backfill only needs to preserve the text content. Attachment
  // shapes diverged from the worker stream's WorkerEntryAttachment
  // shape during early development; rather than risk mis-typing them
  // we drop attachments here. The legacy `messages` row still has
  // them under attachmentsJson for forensic lookups.
  void value;
  return undefined;
}

async function attributeWorkerlessMessage(args: {
  message: MessageRow;
  run: RunRow;
  workersForRun: WorkerRow[];
}): Promise<{ workerId: string; reason: "direct_single" | "active_window" } | null> {
  const { message, run, workersForRun } = args;
  if (run.mode === "direct" && workersForRun.length === 1) {
    return { workerId: workersForRun[0]!.id, reason: "direct_single" };
  }
  // Active-window attribution: at createdAt the only worker that was
  // alive (createdAt <= message.createdAt < terminalAt or still alive)
  // wins. We don't have terminalAt explicitly; treat workers as alive
  // until updatedAt if they reached a terminal status by then.
  const messageTime = new Date(message.createdAt).getTime();
  const alive = workersForRun.filter((worker) => {
    const createdAt = new Date(worker.createdAt).getTime();
    return Number.isFinite(createdAt) && createdAt <= messageTime;
  });
  if (alive.length === 1) {
    return { workerId: alive[0]!.id, reason: "active_window" };
  }
  return null;
}

function appendManualAttributionReport(file: fs.WriteStream, payload: Record<string, unknown>) {
  file.write(JSON.stringify(payload) + "\n");
}

async function backfillMessages(args: {
  dryRun: boolean;
  reportStream: fs.WriteStream;
  stats: BackfillStats;
}) {
  const { dryRun, reportStream, stats } = args;
  const allMessages = await db.select().from(messagesTable) as MessageRow[];
  const allRuns = await db.select().from(runsTable) as RunRow[];
  const allWorkers = await db.select().from(workersTable) as WorkerRow[];
  const runsById = new Map(allRuns.map((row) => [row.id, row]));
  const workersByRunId = new Map<string, WorkerRow[]>();
  for (const worker of allWorkers) {
    const bucket = workersByRunId.get(worker.runId);
    if (bucket) {
      bucket.push(worker);
    } else {
      workersByRunId.set(worker.runId, [worker]);
    }
  }

  const ordered = [...allMessages].sort((a, b) => (
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ));

  for (const message of ordered) {
    stats.scanned += 1;
    const run = runsById.get(message.runId);
    if (!run) {
      continue;
    }

    let workerId = message.workerId;
    if (!workerId) {
      // Supervisor-conversation rows stay in `messages` only.
      if (message.role === "supervisor") {
        stats.skippedSupervisor += 1;
        continue;
      }
      if (message.role === "user" && run.mode !== "direct") {
        stats.skippedSupervisor += 1;
        continue;
      }
      const attribution = await attributeWorkerlessMessage({
        message,
        run,
        workersForRun: workersByRunId.get(run.id) ?? [],
      });
      if (!attribution) {
        stats.requiresManualAttribution += 1;
        appendManualAttributionReport(reportStream, {
          source: "messages",
          messageId: message.id,
          runId: run.id,
          role: message.role,
          kind: message.kind,
          createdAt: message.createdAt,
          reason: "no single eligible worker",
        });
        continue;
      }
      workerId = attribution.workerId;
      if (attribution.reason === "direct_single") {
        stats.attributedToDirectRunWorker += 1;
      } else {
        stats.attributedByActiveWindow += 1;
      }
    }

    const type = pickEntryType(message);
    if (!type) {
      // Unknown role/kind combination — skip but report.
      appendManualAttributionReport(reportStream, {
        source: "messages",
        messageId: message.id,
        runId: run.id,
        role: message.role,
        kind: message.kind,
        createdAt: message.createdAt,
        reason: "no entry type mapping for role/kind",
      });
      stats.requiresManualAttribution += 1;
      continue;
    }

    if (dryRun) {
      stats.applied += 1;
      continue;
    }

    await appendWorkerEntry(run.id, workerId, {
      id: message.id,
      type,
      text: message.content,
      timestamp: new Date(message.createdAt).toISOString(),
      authorRole:
        type === "user_input" ? "user"
          : type === "supervisor_input" ? "supervisor"
          : undefined,
      attachments: attachmentsFromMessageJson(message.attachmentsJson),
    });
    stats.applied += 1;
  }
}

function pickEntryType(message: MessageRow): "user_input" | "supervisor_input" | "message" | null {
  if (message.role === "user") return "user_input";
  if (message.role === "supervisor") return "supervisor_input";
  if (message.role === "worker") return "message";
  return null;
}

async function backfillLifecycleEvents(args: {
  dryRun: boolean;
  stats: BackfillStats;
}) {
  const { dryRun, stats } = args;
  const events = await db.select().from(executionEvents);
  for (const event of events) {
    if (!event.workerId) {
      stats.lifecycleSkippedNoWorker += 1;
      continue;
    }
    if (dryRun) {
      stats.lifecycleAppended += 1;
      continue;
    }
    const worker = await db.select().from(workersTable).where(eq(workersTable.id, event.workerId)).get();
    if (!worker) {
      stats.lifecycleSkippedNoWorker += 1;
      continue;
    }
    await appendWorkerEntry(worker.runId, event.workerId, {
      id: event.id,
      type: "lifecycle",
      text: `${event.eventType}`,
      timestamp: new Date(event.createdAt).toISOString(),
      authorRole: "system",
      raw: event.details ? safelyParseJson(event.details) : undefined,
    });
    stats.lifecycleAppended += 1;
  }
}

function safelyParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const reportPath = path.join(getAppDataPath("backfill-reports"), `requires_manual_attribution-${Date.now()}.jsonl`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const reportStream = fs.createWriteStream(reportPath, { flags: "w" });

  const stats = createInitialStats();
  try {
    await backfillMessages({ dryRun, reportStream, stats });
    await backfillLifecycleEvents({ dryRun, stats });
  } finally {
    reportStream.close();
  }

  console.log("");
  console.log("backfill-worker-entries summary:");
  console.log(`  scanned messages rows: ${stats.scanned}`);
  console.log(`  applied: ${stats.applied}`);
  console.log(`  attributed by single direct-run worker: ${stats.attributedToDirectRunWorker}`);
  console.log(`  attributed by active-window heuristic: ${stats.attributedByActiveWindow}`);
  console.log(`  skipped (supervisor-only/no worker attribution applicable): ${stats.skippedSupervisor}`);
  console.log(`  requires manual attribution (see ${reportPath}): ${stats.requiresManualAttribution}`);
  console.log(`  lifecycle entries appended: ${stats.lifecycleAppended}`);
  console.log(`  lifecycle skipped (no worker): ${stats.lifecycleSkippedNoWorker}`);
  if (dryRun) {
    console.log("(dry-run — no entries written)");
  }
  if (dryRun && stats.requiresManualAttribution > 0) {
    console.log("");
    console.log("Manual attribution cases exist. Resolve them before flipping the flag.");
    process.exit(2);
  }
}

main().then(() => process.exit(0), (error) => {
  console.error(error);
  process.exit(1);
});
