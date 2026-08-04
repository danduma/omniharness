/**
 * Recover a worker transcript whose on-disk stream lost its head.
 *
 * Symptom this repairs: `<runId>/workers/<workerId>.jsonl` starts at a seq
 * far above 1 while `artifact_streams.latest_seq` matches the tail. That
 * happens when the stream file is (re)created while the DB cursor is
 * already advanced — `refreshChainCaches` seeds `nextSeq` from
 * `max(fileMaxSeq, dbLatestSeq) + 1`, so the writer resumes numbering
 * mid-stream and never backfills the missing prefix.
 *
 * The raw bridge output survives in
 * `.omniharness/agent-runtime-output/<workerId>.jsonl`, which is the
 * authoritative chronological record. This script merges that archive with
 * the surviving stream tail, re-numbers the result from 1, and rewrites the
 * stream atomically under the worker file lock.
 *
 * Entries that only ever existed in the stream (`user_input`, `lifecycle` —
 * they are produced server-side, not by the bridge) are preserved and spliced
 * back in chronologically. `user_input` timestamps are corrected from the
 * `messages` table when a match exists, because the stream records the flush
 * time rather than the send time.
 *
 * Verification is the default; `--apply` is opt-in and always leaves a
 * `.pre-recovery-<ts>.bak` beside the rewritten file.
 *
 * Usage:
 *   pnpm exec tsx scripts/recover-worker-transcript.ts --runId e51514929b72
 *   pnpm exec tsx scripts/recover-worker-transcript.ts --runId e51514929b72 --apply
 *   pnpm exec tsx scripts/recover-worker-transcript.ts --all-damaged
 *   pnpm exec tsx scripts/recover-worker-transcript.ts --all-damaged --apply
 */
import { promises as fs, existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { artifactStreams, runs, workers, messages } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveArtifactStreamLocation } from "@/server/artifacts/append-only-store";
import { compactEntryForHistory } from "@/server/workers/output-store";

interface Entry {
  id?: string;
  type?: string;
  text?: string;
  timestamp?: string;
  seq?: number;
  raw?: unknown;
  [key: string]: unknown;
}

interface Options {
  runIds: string[];
  allDamaged: boolean;
  apply: boolean;
  force: boolean;
  archiveDir: string;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = {
    runIds: [],
    allDamaged: false,
    apply: false,
    force: false,
    archiveDir: path.resolve(process.cwd(), ".omniharness/agent-runtime-output"),
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--all-damaged") opts.allDamaged = true;
    else if (arg === "--runId") opts.runIds.push(argv[++i] ?? "");
    else if (arg === "--archive-dir") opts.archiveDir = path.resolve(argv[++i] ?? "");
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: recover-worker-transcript.ts [--runId <id>]... [--all-damaged] [--apply]");
      process.exit(0);
    }
  }
  return opts;
}

function parseJsonl(body: string): Entry[] {
  const out: Entry[] = [];
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as Entry);
    } catch {
      // A torn final line is expected on an interrupted append; skip it.
    }
  }
  return out;
}

/**
 * Re-join streaming deltas the way the agent runtime does.
 *
 * The runtime archive stores every streaming chunk as its OWN record with its
 * own id — `"I"`, then `"'ll investigate the entitlements system"`, and so on.
 * The worker stream stores the *assembled* message. `appendMessageChunk`
 * (src/server/agent-runtime/output-store.ts) is what assembles them: a
 * `message`/`thought` chunk is appended onto the currently-active entry when it
 * has the same type, while any other record type clears the active entry and so
 * ends the run.
 *
 * Replaying the archive without this step writes one entry per chunk, which
 * renders as a transcript shredded mid-word. Verified against the surviving
 * tail of run e51514929b72: reassembling this way reproduces all 12 message and
 * 14 thought bodies byte-for-byte.
 */
function coalesceStreamingDeltas(entries: Entry[]): Entry[] {
  const out: Entry[] = [];
  let active: Entry | null = null;
  for (const entry of entries) {
    const type = entry.type;
    if (type === "message" || type === "thought") {
      if (active && active.type === type) {
        active.text = `${active.text ?? ""}${entry.text ?? ""}`;
        continue;
      }
      const started: Entry = { ...entry };
      out.push(started);
      active = started;
      continue;
    }
    out.push({ ...entry });
    active = null;
  }
  return out;
}

/**
 * Revision key for an entry. `writeWorkerOutputEntries` keeps a second row
 * for the same id when its payload grew (streaming prose), so recovery must
 * preserve distinct revisions while dropping exact repeats.
 */
function revisionKey(entry: Entry): string {
  return JSON.stringify([entry.id ?? "", entry.type ?? "", entry.text ?? "", entry.status ?? ""]);
}

function timeOf(entry: Entry): number {
  const parsed = Date.parse(String(entry.timestamp ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Merge the archive (authoritative order) with stream-only entries, placing
 * each stream-only entry before the first archive entry that is not older.
 */
function mergeChronologically(archive: Entry[], extras: Entry[]): Entry[] {
  const pending = [...extras].sort((a, b) => timeOf(a) - timeOf(b));
  const merged: Entry[] = [];
  let cursor = 0;
  for (const entry of archive) {
    const at = timeOf(entry);
    while (cursor < pending.length && timeOf(pending[cursor]) <= at) {
      merged.push(pending[cursor]);
      cursor += 1;
    }
    merged.push(entry);
  }
  while (cursor < pending.length) {
    merged.push(pending[cursor]);
    cursor += 1;
  }
  return merged;
}

async function correctUserInputTimestamps(runId: string, extras: Entry[]): Promise<void> {
  const rows = await db
    .select({ content: messages.content, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.runId, runId));
  if (rows.length === 0) return;
  for (const entry of extras) {
    if (entry.type !== "user_input") continue;
    const text = String(entry.text ?? "").trim();
    if (!text) continue;
    const match = rows.find((row) => String(row.content ?? "").trim().startsWith(text.slice(0, 60)));
    // `messages.createdAt` is a drizzle timestamp column, so it arrives as a
    // Date; tolerate a raw epoch too in case the column mode ever changes.
    const sentAt = match?.createdAt instanceof Date
      ? match.createdAt
      : typeof match?.createdAt === "number"
        ? new Date(match.createdAt * 1000)
        : null;
    if (!sentAt || Number.isNaN(sentAt.getTime())) continue;
    const corrected = sentAt.toISOString();
    if (corrected !== entry.timestamp) {
      entry.timestamp = corrected;
    }
  }
}

async function withLock<T>(lockPath: string, task: () => Promise<T>): Promise<T> {
  await fs.mkdir(lockPath);
  await fs.writeFile(
    path.join(lockPath, "owner.json"),
    JSON.stringify({ token: randomUUID(), pid: process.pid, createdAt: new Date().toISOString() }),
    "utf8",
  );
  try {
    return await task();
  } finally {
    await fs.rm(lockPath, { recursive: true, force: true });
  }
}

interface Plan {
  runId: string;
  workerId: string;
  filePath: string;
  lockPath: string;
  archivePath: string;
  liveCount: number;
  liveMinSeq: number;
  liveMaxSeq: number;
  rebuilt: Entry[];
  recovered: number;
}

async function planRecovery(runId: string, workerId: string, opts: Options): Promise<Plan | null> {
  const run = await db
    .select({ projectPath: runs.projectPath })
    .from(runs)
    .where(eq(runs.id, runId))
    .get();
  if (!run) {
    console.warn(`[skip] ${runId}: no runs row`);
    return null;
  }

  const location = await resolveArtifactStreamLocation(
    { runId, kind: "worker_entries", ownerId: workerId, projectPath: run.projectPath ?? null },
    "read",
  );
  const filePath = location.filePath;
  if (!existsSync(filePath)) {
    console.warn(`[skip] ${workerId}: stream file missing at ${filePath}`);
    return null;
  }

  const live = parseJsonl(await fs.readFile(filePath, "utf8"));
  if (live.length === 0) {
    console.warn(`[skip] ${workerId}: stream file is empty`);
    return null;
  }
  const seqs = live.map((e) => (typeof e.seq === "number" ? e.seq : 0)).filter((s) => s > 0);
  const liveMinSeq = seqs.length ? Math.min(...seqs) : 0;
  const liveMaxSeq = seqs.length ? Math.max(...seqs) : 0;

  const archivePath = path.join(opts.archiveDir, `${workerId}.jsonl`);
  if (!existsSync(archivePath)) {
    console.warn(`[skip] ${workerId}: no runtime archive at ${archivePath}`);
    return null;
  }
  // Reassemble streaming chunks before anything else — the raw archive is
  // per-chunk, the stream is per-message.
  const archive = coalesceStreamingDeltas(parseJsonl(await fs.readFile(archivePath, "utf8")));

  const archiveIds = new Set(archive.map((e) => e.id).filter(Boolean) as string[]);
  const extras = live.filter((e) => !e.id || !archiveIds.has(e.id));
  await correctUserInputTimestamps(runId, extras);

  const merged = mergeChronologically(archive, extras);

  // Drop exact repeats while preserving genuine revisions, mirroring the
  // (id, fingerprint) dedup the writer applies.
  const seenRevisions = new Set<string>();
  const deduped: Entry[] = [];
  for (const entry of merged) {
    const key = revisionKey(entry);
    if (entry.id && seenRevisions.has(key)) continue;
    if (entry.id) seenRevisions.add(key);
    deduped.push(entry);
  }

  const rebuilt = deduped.map((entry, index) => {
    const { seq: _ignored, ...rest } = entry;
    return compactEntryForHistory({ ...rest, seq: index + 1 } as Entry);
  });

  // Safety invariant: recovery must never drop an entry that is currently
  // visible on disk.
  const rebuiltIds = new Set(rebuilt.map((e) => e.id).filter(Boolean) as string[]);
  const lost = live.filter((e) => e.id && !rebuiltIds.has(e.id));
  if (lost.length > 0) {
    throw new Error(
      `${workerId}: refusing to rewrite — ${lost.length} currently-persisted entries would be lost `
      + `(first: ${lost[0].id})`,
    );
  }

  return {
    runId,
    workerId,
    filePath,
    lockPath: location.lockPath,
    archivePath,
    liveCount: live.length,
    liveMinSeq,
    liveMaxSeq,
    rebuilt,
    recovered: rebuilt.length - live.length,
  };
}

async function syncStreamMetadata(
  runId: string,
  workerId: string,
  latestSeq: number,
  latestRecordId: string | null,
): Promise<void> {
  await db
    .update(artifactStreams)
    .set({
      latestSeq,
      latestRecordId: latestRecordId ?? `seq-${latestSeq}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(artifactStreams.runId, runId),
        eq(artifactStreams.kind, "worker_entries"),
        eq(artifactStreams.ownerId, workerId),
      ),
    );
}

async function applyRecovery(plan: Plan): Promise<void> {
  const body = plan.rebuilt.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${plan.filePath}.pre-recovery-${stamp}.bak`;
  const tmpPath = `${plan.filePath}.recover-${process.pid}.tmp`;

  await withLock(plan.lockPath, async () => {
    await fs.copyFile(plan.filePath, backupPath);
    const handle = await fs.open(tmpPath, "w");
    try {
      await handle.writeFile(body, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await fs.rename(tmpPath, plan.filePath);
  });

  const last = plan.rebuilt.at(-1);
  await syncStreamMetadata(
    plan.runId,
    plan.workerId,
    typeof last?.seq === "number" ? last.seq : plan.rebuilt.length,
    last?.id ?? null,
  );

  // Stale sparse index would point at pre-rewrite byte offsets.
  for (const suffix of [".idx", ".gz"]) {
    const sidecar = `${plan.filePath}${suffix}`;
    if (existsSync(sidecar)) await fs.rm(sidecar, { force: true });
  }

  console.log(`  backup: ${backupPath}`);
}

async function findDamagedWorkers(): Promise<Array<{ runId: string; workerId: string }>> {
  const rows = await db
    .select({
      runId: artifactStreams.runId,
      ownerId: artifactStreams.ownerId,
      latestSeq: artifactStreams.latestSeq,
    })
    .from(artifactStreams)
    .where(eq(artifactStreams.kind, "worker_entries"));
  const damaged: Array<{ runId: string; workerId: string }> = [];
  for (const row of rows) {
    const run = await db
      .select({ projectPath: runs.projectPath })
      .from(runs)
      .where(eq(runs.id, row.runId))
      .get();
    if (!run) continue;
    const location = await resolveArtifactStreamLocation(
      { runId: row.runId, kind: "worker_entries", ownerId: row.ownerId, projectPath: run.projectPath ?? null },
      "read",
    );
    if (!existsSync(location.filePath)) continue;
    const entries = parseJsonl(await fs.readFile(location.filePath, "utf8"));
    const seqs = entries.map((e) => (typeof e.seq === "number" ? e.seq : 0)).filter((s) => s > 0);
    if (seqs.length === 0) continue;
    // Head truncation, or a DB cursor that disagrees with the file tail
    // (which is what an interrupted recovery leaves behind).
    if (Math.min(...seqs) > 1 || row.latestSeq !== Math.max(...seqs)) {
      damaged.push({ runId: row.runId, workerId: row.ownerId });
    }
  }
  return damaged;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let targets: Array<{ runId: string; workerId: string }> = [];
  if (opts.allDamaged) {
    targets = await findDamagedWorkers();
    console.log(`Found ${targets.length} head-truncated worker stream(s).`);
  } else if (opts.runIds.length > 0) {
    for (const runId of opts.runIds) {
      const rows = await db.select({ id: workers.id }).from(workers).where(eq(workers.runId, runId));
      for (const row of rows) targets.push({ runId, workerId: row.id });
    }
  } else {
    console.error("Nothing to do: pass --runId <id> or --all-damaged.");
    process.exit(1);
  }

  let repaired = 0;
  for (const target of targets) {
    const plan = await planRecovery(target.runId, target.workerId, opts);
    if (!plan) continue;
    if (!opts.force && plan.liveMinSeq <= 1 && plan.recovered <= 0) {
      // Content is intact; the DB cursor may still disagree with the file
      // tail (an interrupted recovery leaves exactly this state).
      console.log(`[${opts.apply ? "apply" : "dry-run"}] ${plan.workerId}: content intact — syncing metadata cursor to seq ${plan.liveMaxSeq}.`);
      if (opts.apply) {
        await syncStreamMetadata(plan.runId, plan.workerId, plan.liveMaxSeq, plan.rebuilt.at(-1)?.id ?? null);
        repaired += 1;
      }
      continue;
    }
    console.log(
      `[${opts.apply ? "apply" : "dry-run"}] ${plan.workerId}: `
      + `on-disk seq ${plan.liveMinSeq}..${plan.liveMaxSeq} (${plan.liveCount} entries) `
      + `-> rebuilt seq 1..${plan.rebuilt.length} (+${plan.recovered} recovered)`,
    );
    if (opts.apply) {
      await applyRecovery(plan);
      repaired += 1;
    }
  }

  console.log(opts.apply ? `Repaired ${repaired} stream(s).` : "Dry run only — re-run with --apply to write.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
