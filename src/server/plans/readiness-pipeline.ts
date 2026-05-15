import { createHash } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { parsePlan } from "@/server/plans/parser";
import {
  assessPlanStructure,
  describeStructuralGaps,
  structureHasBlockingGaps,
  type PlanStructuralFacts,
} from "@/server/plans/readiness";
import {
  assessPlanReadinessWithLLM,
  type PlanReadinessVerdict,
} from "@/server/plans/readiness-llm";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

export type PlanReadinessAnalysisStatus =
  | "analyzing"
  | "ready"
  | "fallback";

export interface PlanReadinessRecord {
  status: PlanReadinessAnalysisStatus;
  planPath: string;
  planHash: string;
  specHash: string | null;
  structure: PlanStructuralFacts;
  verdict: PlanReadinessVerdict | null;
  fallbackHeadline: string | null;
  error: string | null;
  generatedAt: number;
}

interface VerdictMap {
  [planHash: string]: PlanReadinessRecord;
}

const inFlight = new Map<string, Promise<PlanReadinessRecord>>();

// Cached "analyzing" records older than this are treated as crashed and the
// pipeline re-issues the call.
const STALE_ANALYZING_MS = 60_000;
// Minimum interval between LLM calls per run, regardless of plan hash, to
// protect against runaway flushes producing many distinct hashes in a burst.
const RUN_RATE_LIMIT_MS = 5_000;

const lastCallByRun = new Map<string, number>();

function hashString(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPlanMarkdown(markdown: string) {
  return hashString(markdown);
}

function inflightKey(runId: string, planHash: string) {
  return `${runId}:${planHash}`;
}

function readFileSafely(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseVerdictMap(value: string | null | undefined): VerdictMap {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as VerdictMap;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

export function deriveFallbackHeadline(structure: PlanStructuralFacts, gaps: string[]): string {
  if (structure.itemCount === 0) {
    return "Plan file has no checklist items — open it, add concrete tasks, and try again.";
  }

  const concerns: string[] = [];
  if (structure.itemsWithStubTitle.length > 0) {
    concerns.push(`${structure.itemsWithStubTitle.length} item(s) are stubs`);
  }
  if (structure.itemsMissingVerify.length === structure.itemCount && !structure.hasAcceptanceCriteria) {
    concerns.push("no Verify lines and no acceptance criteria");
  } else if (structure.itemsMissingVerify.length > 0 && !structure.hasAcceptanceCriteria) {
    concerns.push(`${structure.itemsMissingVerify.length} item(s) have no Verify line`);
  }
  if (structure.itemsWithVagueTitle.length > 0) {
    concerns.push(`${structure.itemsWithVagueTitle.length} item(s) have vague titles`);
  }

  if (concerns.length === 0 && gaps.length === 0) {
    return "Plan detected — review the file below before starting implementation.";
  }

  if (concerns.length === 0) {
    return `Plan detected — ${gaps[0]}`;
  }

  return `Plan detected — ${concerns.join("; ")}. Review before implementation.`;
}

export function readinessRecordIsReady(record: PlanReadinessRecord | null | undefined): boolean {
  if (!record) return false;
  if (record.status === "analyzing") return false;
  if (record.verdict) {
    return record.verdict.verdict === "ready";
  }
  return !structureHasBlockingGaps(record.structure);
}

export function readinessRecordHeadline(record: PlanReadinessRecord | null | undefined): string | null {
  if (!record) return null;
  if (record.verdict) return record.verdict.headline;
  return record.fallbackHeadline;
}

export async function loadCachedReadinessRecord(args: {
  runId: string;
  planPath: string;
  planHash: string;
}): Promise<PlanReadinessRecord | null> {
  const row = await db.select({ json: runs.plannerReadinessVerdictJson }).from(runs).where(eq(runs.id, args.runId)).get();
  const map = parseVerdictMap(row?.json ?? null);
  const cached = map[args.planHash];
  if (cached && cached.planPath === args.planPath) {
    return cached;
  }
  return null;
}

async function persistReadinessRecord(args: { runId: string; record: PlanReadinessRecord }) {
  const row = await db
    .select({
      verdictJson: runs.plannerReadinessVerdictJson,
      artifactsJson: runs.plannerArtifactsJson,
    })
    .from(runs)
    .where(eq(runs.id, args.runId))
    .get();
  const map = parseVerdictMap(row?.verdictJson ?? null);

  // Keep map bounded — only retain entries that are not the newest one for each plan path.
  const trimmed: VerdictMap = {};
  const entries = Object.entries(map);
  // Sort newest first so we keep recency.
  entries.sort((a, b) => b[1].generatedAt - a[1].generatedAt);
  let kept = 0;
  for (const [hash, record] of entries) {
    if (kept >= 16) break;
    trimmed[hash] = record;
    kept += 1;
  }
  trimmed[args.record.planHash] = args.record;

  // Also patch the candidate's readinessRecord inside plannerArtifactsJson so
  // the artifacts panel sees the latest verdict without waiting for a fresh
  // refreshPlanningArtifactsForRun pass.
  const artifactsJson = patchArtifactsJsonWithRecord(row?.artifactsJson ?? null, args.record);

  await db.update(runs).set({
    plannerReadinessVerdictJson: JSON.stringify(trimmed),
    ...(artifactsJson !== null ? { plannerArtifactsJson: artifactsJson } : {}),
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));
}

function patchArtifactsJsonWithRecord(
  artifactsJson: string | null | undefined,
  record: PlanReadinessRecord,
): string | null {
  if (!artifactsJson?.trim()) return null;
  let parsed: { candidates?: Array<{ path?: string; readinessRecord?: unknown }> };
  try {
    parsed = JSON.parse(artifactsJson);
  } catch {
    return null;
  }
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : null;
  if (!candidates) return null;
  let mutated = false;
  for (const candidate of candidates) {
    if (candidate?.path === record.planPath) {
      candidate.readinessRecord = record;
      mutated = true;
    }
  }
  return mutated ? JSON.stringify(parsed) : null;
}

export interface BuildReadinessArgs {
  runId: string;
  planPath: string;
  planMarkdown: string;
  specPath: string | null;
  specMarkdown: string | null;
}

function buildBaseRecord(args: BuildReadinessArgs): Omit<PlanReadinessRecord, "status" | "verdict" | "fallbackHeadline" | "error"> & {
  fallbackHeadline: string;
} {
  const parsed = parsePlan(args.planMarkdown);
  const structure = assessPlanStructure(parsed);
  const gaps = describeStructuralGaps(parsed, structure);
  return {
    planPath: args.planPath,
    planHash: hashString(args.planMarkdown),
    specHash: args.specMarkdown ? hashString(args.specMarkdown) : null,
    structure,
    fallbackHeadline: deriveFallbackHeadline(structure, gaps),
    generatedAt: Date.now(),
  };
}

export function buildStructuralReadinessRecord(args: BuildReadinessArgs): PlanReadinessRecord {
  const base = buildBaseRecord(args);
  return {
    ...base,
    status: "fallback",
    verdict: null,
    error: null,
  };
}

export async function ensureReadinessVerdict(args: BuildReadinessArgs): Promise<PlanReadinessRecord> {
  const base = buildBaseRecord(args);

  const cached = await loadCachedReadinessRecord({
    runId: args.runId,
    planPath: args.planPath,
    planHash: base.planHash,
  });
  if (cached) {
    // "ready" verdicts are final, "fallback" entries are returned as-is to
    // avoid hammering the LLM when it is unavailable, and "analyzing" usually
    // means another caller has a request in flight. The exception: an
    // "analyzing" record older than STALE_ANALYZING_MS means a previous
    // process exited mid-call and never finalized — re-trigger.
    if (cached.status !== "analyzing" || Date.now() - cached.generatedAt <= STALE_ANALYZING_MS) {
      return cached;
    }
  }

  const key = inflightKey(args.runId, base.planHash);
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

  const lastCall = lastCallByRun.get(args.runId) ?? 0;
  if (Date.now() - lastCall < RUN_RATE_LIMIT_MS) {
    // Too soon — return a fallback record without spending the call.
    return {
      ...base,
      status: "fallback",
      verdict: null,
      fallbackHeadline: base.fallbackHeadline,
      error: "rate_limited",
    };
  }
  lastCallByRun.set(args.runId, Date.now());

  const analyzingRecord: PlanReadinessRecord = {
    ...base,
    status: "analyzing",
    verdict: null,
    fallbackHeadline: base.fallbackHeadline,
    error: null,
  };

  await persistReadinessRecord({ runId: args.runId, record: analyzingRecord });
  notifyEventStreamSubscribers();

  const promise = (async (): Promise<PlanReadinessRecord> => {
    const outcome = await assessPlanReadinessWithLLM({
      planMarkdown: args.planMarkdown,
      specMarkdown: args.specMarkdown,
      structure: base.structure,
    });

    const finalized: PlanReadinessRecord = outcome.ok
      ? {
          ...base,
          status: "ready",
          verdict: outcome.verdict,
          fallbackHeadline: base.fallbackHeadline,
          error: null,
        }
      : {
          ...base,
          status: "fallback",
          verdict: null,
          fallbackHeadline: base.fallbackHeadline,
          error: outcome.error,
        };

    await persistReadinessRecord({ runId: args.runId, record: finalized });
    notifyEventStreamSubscribers();
    return finalized;
  })();

  inFlight.set(key, promise);
  promise.finally(() => {
    inFlight.delete(key);
  });

  return analyzingRecord;
}

export async function readinessRecordsForRun(runId: string): Promise<VerdictMap> {
  const row = await db.select({ json: runs.plannerReadinessVerdictJson }).from(runs).where(eq(runs.id, runId)).get();
  return parseVerdictMap(row?.json ?? null);
}

export async function readinessRecordForPlanFile(args: {
  runId: string;
  planPath: string;
}): Promise<PlanReadinessRecord | null> {
  const markdown = readFileSafely(args.planPath);
  if (!markdown) return null;
  const planHash = hashString(markdown);
  return loadCachedReadinessRecord({
    runId: args.runId,
    planPath: args.planPath,
    planHash,
  });
}
