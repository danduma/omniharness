import fs from "fs";
import path from "path";
import { assessPlanReadiness, type PlanReadinessAssessment } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";

export interface PlannerHandoff {
  specPath: string | null;
  planPath: string | null;
  ready: boolean;
  summary: string | null;
}

export interface PlannerArtifactCandidate {
  path: string;
  kind: "spec" | "plan" | "unknown";
  source: "handoff" | "output_text";
  confidence: number;
  evidence: string;
  exists: boolean;
  readiness?: PlanReadinessAssessment | null;
}

export interface PlannerArtifacts {
  specPath: string | null;
  planPath: string | null;
  candidates: PlannerArtifactCandidate[];
}

function normalizeCandidatePath(cwd: string, candidate: string) {
  const trimmed = candidate.trim().replace(/^["'`]|["'`]$/g, "");
  if (!trimmed) {
    return null;
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
}

function inferKind(candidatePath: string) {
  const lower = candidatePath.toLowerCase();
  if (lower.includes("/specs/") || lower.includes("-design.md")) return "spec";
  if (lower.includes("/plans/") || lower.includes("plan")) return "plan";
  return "unknown";
}

function extractMarkdownPaths(outputText: string) {
  const matches = outputText.match(/(?:\/[\w./-]+|(?:docs|vibes)[\w./-]*|\.?\.?\/[\w./-]+)\.md\b/g) ?? [];
  return Array.from(new Set(matches));
}

export function extractPlannerHandoffBlock(outputText: string): PlannerHandoff | null {
  const matches = Array.from(outputText.matchAll(/<omniharness-plan-handoff>([\s\S]*?)<\/omniharness-plan-handoff>/gi));
  const match = matches.at(-1);
  if (!match) {
    return null;
  }

  const lines = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const byKey = new Map<string, string>();
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    byKey.set(key, value);
  }

  return {
    specPath: byKey.get("spec_path") || null,
    planPath: byKey.get("plan_path") || null,
    ready: /^(yes|true)$/i.test(byKey.get("ready") || ""),
    summary: byKey.get("summary") || null,
  };
}

async function buildCandidate(args: {
  cwd: string;
  rawPath: string;
  source: "handoff" | "output_text";
  evidence: string;
  confidence: number;
}) {
  const resolvedPath = normalizeCandidatePath(args.cwd, args.rawPath);
  if (!resolvedPath) {
    return null;
  }

  const exists = fs.existsSync(resolvedPath);
  const kind = inferKind(resolvedPath);
  let readiness: PlanReadinessAssessment | null = null;

  if (exists && kind === "plan") {
    const markdown = fs.readFileSync(resolvedPath, "utf8");
    readiness = await assessPlanReadiness(parsePlan(markdown));
  }

  return {
    path: resolvedPath,
    kind,
    source: args.source,
    confidence: args.confidence,
    evidence: args.evidence,
    exists,
    readiness,
  } satisfies PlannerArtifactCandidate;
}

export async function collectPlannerArtifacts(args: {
  cwd: string;
  outputText: string;
}): Promise<PlannerArtifacts> {
  const handoff = extractPlannerHandoffBlock(args.outputText);
  const candidates: PlannerArtifactCandidate[] = [];
  const seenPaths = new Set<string>();

  const handoffInputs = [
    ...(handoff?.specPath ? [{ rawPath: handoff.specPath, source: "handoff" as const, evidence: "spec_path in handoff block", confidence: 1 }] : []),
    ...(handoff?.planPath ? [{ rawPath: handoff.planPath, source: "handoff" as const, evidence: "plan_path in handoff block", confidence: 1 }] : []),
  ];
  const candidateInputs = [
    ...handoffInputs,
    ...(handoffInputs.length > 0
      ? []
      : extractMarkdownPaths(args.outputText).map((rawPath) => ({
        rawPath,
        source: "output_text" as const,
        evidence: `mentioned in output: ${rawPath}`,
        confidence: 0.65,
      }))),
  ];

  for (const input of candidateInputs) {
    const candidate = await buildCandidate({
      cwd: args.cwd,
      rawPath: input.rawPath,
      source: input.source,
      evidence: input.evidence,
      confidence: input.confidence,
    });
    if (!candidate || seenPaths.has(candidate.path)) {
      continue;
    }

    seenPaths.add(candidate.path);
    candidates.push(candidate);
  }

  const specCandidates = candidates.filter((candidate) => candidate.kind === "spec" && candidate.exists);
  const planCandidates = candidates.filter((candidate) => candidate.kind === "plan" && candidate.exists);

  const specPath = handoff?.specPath && specCandidates.length > 0
    ? specCandidates[0]?.path ?? null
    : specCandidates.length === 1
      ? specCandidates[0]?.path ?? null
      : null;

  const handoffPlanPath = handoff?.planPath
    ? normalizeCandidatePath(args.cwd, handoff.planPath)
    : null;
  const planPath = handoffPlanPath && planCandidates.some((candidate) => candidate.path === handoffPlanPath)
    ? handoffPlanPath
    : planCandidates.length === 1
      ? planCandidates[0]?.path ?? null
      : null;

  return { specPath, planPath, candidates };
}
