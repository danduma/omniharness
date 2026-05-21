/**
 * Backfill the unified worker conversation stream from legacy
 * `.omniharness/agent-runtime-output/<workerId>.jsonl` files written
 * by the agent runtime's pre-cutover output archive.
 *
 * Sessions that ran before the worker conversation stream cutover never
 * had their bridge-produced entries (message / thought / tool_call /
 * tool_call_update / permission) routed through `appendWorkerEntry`.
 * The frontend now reads exclusively from the worker stream, so those
 * conversations appear empty in the UI even though the raw bridge
 * output is on disk.
 *
 * This script replays each runtime-output line through
 * `appendWorkerEntry`, which is idempotent (dedup by `entry.id`). Safe
 * to re-run.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-runtime-output-to-worker-stream.ts
 *   pnpm tsx scripts/backfill-runtime-output-to-worker-stream.ts --dry-run
 *   pnpm tsx scripts/backfill-runtime-output-to-worker-stream.ts --workerId <id>
 *   pnpm tsx scripts/backfill-runtime-output-to-worker-stream.ts --verbose
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { db } from "@/server/db";
import { workers as workersTable } from "@/server/db/schema";
import { appendWorkerEntry } from "@/server/workers/output-store";
import type { BridgeWorkerEntryType, WorkerEntry } from "@/server/workers/entries-types";

const BRIDGE_TYPES: ReadonlySet<string> = new Set<BridgeWorkerEntryType>([
  "message",
  "thought",
  "tool_call",
  "tool_call_update",
  "permission",
]);

interface Options {
  dryRun: boolean;
  workerId: string | null;
  verbose: boolean;
  runtimeOutputDir: string;
}

interface FileStats {
  workerId: string;
  runId: string | null;
  totalLines: number;
  appended: number;
  skippedDuplicate: number;
  skippedNonBridge: number;
  malformed: number;
}

function parseOptions(argv: string[]): Options {
  const opts: Options = {
    dryRun: false,
    workerId: null,
    verbose: false,
    runtimeOutputDir: path.resolve(process.cwd(), ".omniharness/agent-runtime-output"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--verbose") opts.verbose = true;
    else if (arg === "--workerId") opts.workerId = argv[++i] ?? null;
    else if (arg === "--runtime-output-dir") opts.runtimeOutputDir = path.resolve(argv[++i] ?? "");
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: pnpm tsx scripts/backfill-runtime-output-to-worker-stream.ts [--dry-run] [--workerId <id>] [--verbose]");
      process.exit(0);
    }
  }
  return opts;
}

async function processFile(
  filePath: string,
  workerId: string,
  runId: string,
  opts: Options,
): Promise<FileStats> {
  const stats: FileStats = {
    workerId,
    runId,
    totalLines: 0,
    appended: 0,
    skippedDuplicate: 0,
    skippedNonBridge: 0,
    malformed: 0,
  };

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.totalLines += 1;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      stats.malformed += 1;
      continue;
    }

    const type = parsed.type;
    if (typeof type !== "string" || !BRIDGE_TYPES.has(type)) {
      stats.skippedNonBridge += 1;
      continue;
    }
    const id = parsed.id;
    if (typeof id !== "string" || !id) {
      stats.malformed += 1;
      continue;
    }
    const timestamp = typeof parsed.timestamp === "string" ? parsed.timestamp : new Date().toISOString();
    const text = typeof parsed.text === "string" ? parsed.text : "";

    if (opts.dryRun) {
      stats.appended += 1;
      continue;
    }

    const entry: Omit<WorkerEntry, "seq"> = {
      id,
      type: type as BridgeWorkerEntryType,
      text,
      timestamp,
      toolCallId: typeof parsed.toolCallId === "string" ? parsed.toolCallId : undefined,
      toolKind: typeof parsed.toolKind === "string" ? parsed.toolKind : undefined,
      status: typeof parsed.status === "string" ? parsed.status : undefined,
      raw: parsed.raw,
    };

    try {
      // appendWorkerEntry dedups by entry.id; replaying is safe.
      // We can't observe `appended` from this entrypoint, so we treat
      // any non-throwing call as success and post-tally with a count
      // delta below. For simplicity here we just count attempts; a
      // re-run reports the new dedup hits as `skippedDuplicate=0`
      // attempts because dedup happens server-side and is silent.
      await appendWorkerEntry(runId, workerId, entry);
      stats.appended += 1;
    } catch (error) {
      stats.malformed += 1;
      if (opts.verbose) {
        console.warn(`[backfill] ${workerId} line ${stats.totalLines} failed:`, error);
      }
    }
  }

  return stats;
}

async function main() {
  const opts = parseOptions(process.argv.slice(2));

  if (!fs.existsSync(opts.runtimeOutputDir)) {
    console.error(`Runtime output dir not found: ${opts.runtimeOutputDir}`);
    process.exit(1);
  }

  type WorkerRow = typeof workersTable.$inferSelect;
  const allWorkers = (await db.select().from(workersTable)) as WorkerRow[];
  const workerById = new Map<string, WorkerRow>(allWorkers.map((row) => [row.id, row]));

  const files = fs.readdirSync(opts.runtimeOutputDir).filter((name) => name.endsWith(".jsonl"));
  const targets = opts.workerId
    ? files.filter((name) => name === `${opts.workerId}.jsonl`)
    : files;

  if (targets.length === 0) {
    console.log("No matching runtime-output files.");
    return;
  }

  const totals = {
    files: 0,
    skippedNoWorkerRow: 0,
    totalLines: 0,
    appended: 0,
    skippedNonBridge: 0,
    malformed: 0,
  };

  for (const file of targets) {
    const workerId = file.replace(/\.jsonl$/, "");
    const workerRow = workerById.get(workerId);
    if (!workerRow) {
      totals.skippedNoWorkerRow += 1;
      if (opts.verbose) console.log(`[skip] no workers row for ${workerId}`);
      continue;
    }
    const stats = await processFile(
      path.join(opts.runtimeOutputDir, file),
      workerId,
      workerRow.runId,
      opts,
    );
    totals.files += 1;
    totals.totalLines += stats.totalLines;
    totals.appended += stats.appended;
    totals.skippedNonBridge += stats.skippedNonBridge;
    totals.malformed += stats.malformed;
    if (opts.verbose || stats.malformed > 0) {
      console.log(`[done] ${workerId}: ${JSON.stringify(stats)}`);
    }
  }

  console.log("Backfill summary:");
  console.log(JSON.stringify({ ...totals, dryRun: opts.dryRun }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
