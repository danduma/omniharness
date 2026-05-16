import fs from "fs";
import os from "os";
import path from "path";
import { assessPlanReadiness, type PlanReadinessAssessment } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";
import type { PlanReadinessRecord } from "@/server/plans/readiness-pipeline";

const SCRATCH_SEARCH_MAX_DEPTH = 6;

function getAgentScratchRoots(): string[] {
  const override = process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS?.trim();
  if (override) {
    return override.split(path.delimiter).map((root) => path.resolve(root)).filter(Boolean);
  }
  return [path.resolve(path.join(os.homedir(), ".gemini", "tmp"))];
}

function isInsideScratchRoot(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  return getAgentScratchRoots().some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

function extractScratchAbsolutePaths(outputText: string): string[] {
  const roots = getAgentScratchRoots();
  if (roots.length === 0) return [];
  const absMarkdownPattern = /\/[\w./-]+\.md\b/g;
  const seen = new Set<string>();
  for (const match of outputText.matchAll(absMarkdownPattern)) {
    const candidate = match[0];
    if (roots.some((root) => candidate === root || candidate.startsWith(root + path.sep))) {
      seen.add(candidate);
    }
  }
  return [...seen];
}

function copyIntoProjectStandardDir(args: {
  cwd: string;
  kind: "spec" | "plan" | "unknown";
  sourcePath: string;
}): string | null {
  const subdir = args.kind === "spec" ? "specs" : "plans";
  const targetDir = path.join(args.cwd, "docs", "superpowers", subdir);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {
    return null;
  }
  const target = path.join(targetDir, path.basename(args.sourcePath));
  try {
    if (!fs.existsSync(target)) {
      fs.copyFileSync(args.sourcePath, target);
    }
  } catch {
    return null;
  }
  return target;
}

function searchScratchByBasename(dir: string, basename: string, depth: number): string | null {
  if (depth < 0) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === basename) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = searchScratchByBasename(full, basename, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function findScratchArtifact(basename: string): string | null {
  for (const root of getAgentScratchRoots()) {
    if (!fs.existsSync(root)) continue;
    const found = searchScratchByBasename(root, basename, SCRATCH_SEARCH_MAX_DEPTH);
    if (found) return found;
  }
  return null;
}

function relocateByBasenameFromScratch(args: {
  cwd: string;
  kind: "spec" | "plan" | "unknown";
  rawPath: string;
}): { path: string; relocatedFrom: string } | null {
  const basename = path.basename(args.rawPath.trim().replace(/^["'`]|["'`]$/g, ""));
  if (!basename || !basename.toLowerCase().endsWith(".md")) {
    return null;
  }
  const found = findScratchArtifact(basename);
  if (!found) return null;
  const target = copyIntoProjectStandardDir({ cwd: args.cwd, kind: args.kind, sourcePath: found });
  return target ? { path: target, relocatedFrom: found } : null;
}

export interface PlannerHandoff {
  specPath: string | null;
  planPath: string | null;
  ready: boolean;
  summary: string | null;
}

export interface PlannerArtifactCandidate {
  path: string;
  kind: "spec" | "plan" | "unknown";
  source: "handoff" | "output_text" | "inferred";
  confidence: number;
  evidence: string;
  exists: boolean;
  readiness?: PlanReadinessAssessment | null;
  readinessRecord?: PlanReadinessRecord | null;
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

function inferKind(candidatePath: string): PlannerArtifactCandidate["kind"] {
  const lower = candidatePath.toLowerCase();
  if (lower.includes("/specs/") || lower.includes("-design.md")) return "spec";
  if (lower.includes("/plans/") || lower.includes("plan")) return "plan";
  return "unknown";
}

function inferSiblingSpecPaths(planPath: string) {
  const normalizedPlanPath = path.normalize(planPath);
  const segments = normalizedPlanPath.split(path.sep);
  const plansIndex = segments.lastIndexOf("plans");
  if (plansIndex < 0) {
    return [];
  }

  const parsed = path.parse(normalizedPlanPath);
  const specsSegments = [...segments.slice(0, -1)];
  specsSegments[plansIndex] = "specs";
  const specsDir = specsSegments.join(path.sep) || path.sep;
  const baseNames = [
    parsed.name.replace(/-implementation$/, "-design"),
    parsed.name.replace(/-plan$/, "-design"),
    `${parsed.name}-design`,
    parsed.name,
  ];

  return Array.from(new Set(baseNames))
    .map((baseName) => path.join(specsDir, `${baseName}${parsed.ext || ".md"}`));
}

function extractMarkdownPaths(outputText: string) {
  const artifactReferencePattern = /\b(?:created|drafted|finalized|generated|handoff|prepared|saved|updated|wrote|spec_path|plan_path)\b/i;
  const markdownPathPattern = /(?:\/[\w./-]+|(?:docs|vibes)[\w./-]*|\.?\.?\/[\w./-]+)\.md\b/g;
  const matches: string[] = [];
  let artifactReferenceContextLines = 0;

  for (const line of outputText.split(/\r?\n/)) {
    const hasArtifactReference = artifactReferencePattern.test(line);
    if (hasArtifactReference) {
      artifactReferenceContextLines = 3;
    }

    if (!hasArtifactReference && artifactReferenceContextLines === 0) {
      continue;
    }

    matches.push(...line.matchAll(markdownPathPattern).map((match) => match[0]));

    if (!hasArtifactReference && artifactReferenceContextLines > 0) {
      artifactReferenceContextLines -= 1;
    }
  }

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
  source: PlannerArtifactCandidate["source"];
  evidence: string;
  confidence: number;
}) {
  const resolvedPath = normalizeCandidatePath(args.cwd, args.rawPath);
  if (!resolvedPath) {
    return null;
  }

  let finalPath = resolvedPath;
  let kind = inferKind(resolvedPath);
  let evidence = args.evidence;
  let exists = fs.existsSync(finalPath);

  if (exists && isInsideScratchRoot(finalPath)) {
    const target = copyIntoProjectStandardDir({ cwd: args.cwd, kind, sourcePath: finalPath });
    if (target) {
      evidence = `${evidence}; relocated from agent scratch dir ${finalPath}`;
      finalPath = target;
      kind = inferKind(finalPath);
      exists = fs.existsSync(finalPath);
    }
  } else if (!exists && args.source === "handoff") {
    const relocated = relocateByBasenameFromScratch({
      cwd: args.cwd,
      kind,
      rawPath: args.rawPath,
    });
    if (relocated) {
      finalPath = relocated.path;
      kind = inferKind(finalPath);
      exists = fs.existsSync(finalPath);
      evidence = `${evidence}; relocated from agent scratch dir ${relocated.relocatedFrom}`;
    }
  }

  let readiness: PlanReadinessAssessment | null = null;
  if (exists && kind === "plan") {
    const markdown = fs.readFileSync(finalPath, "utf8");
    readiness = await assessPlanReadiness(parsePlan(markdown));
  }

  return {
    path: finalPath,
    kind,
    source: args.source,
    confidence: args.confidence,
    evidence,
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
  const scratchFallbackInputs = extractScratchAbsolutePaths(args.outputText).map((rawPath) => ({
    rawPath,
    source: "output_text" as const,
    evidence: `agent scratch path mentioned in output: ${rawPath}`,
    confidence: 0.8,
  }));
  const candidateInputs = [
    ...handoffInputs,
    ...(handoffInputs.length > 0
      ? scratchFallbackInputs
      : [
        ...extractMarkdownPaths(args.outputText).map((rawPath) => ({
          rawPath,
          source: "output_text" as const,
          evidence: `mentioned in output: ${rawPath}`,
          confidence: 0.65,
        })),
        ...scratchFallbackInputs,
      ]),
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
    if (handoff?.ready && input.source === "handoff" && candidate.kind === "plan") {
      candidate.readiness = {
        ready: true,
        questions: [],
        gaps: [],
        structure: candidate.readiness?.structure ?? {
          itemCount: 0,
          hasAcceptanceCriteria: false,
          hasGoalSection: false,
          itemsMissingDetails: [],
          itemsMissingVerify: [],
          itemsWithEmptyVerify: [],
          itemsWithVagueTitle: [],
          itemsWithStubTitle: [],
        },
      };
    }

    seenPaths.add(candidate.path);
    candidates.push(candidate);
  }

  const explicitSpecCandidates = candidates.filter((candidate) => candidate.kind === "spec" && candidate.exists);
  if (explicitSpecCandidates.length === 0) {
    const detectedPlanCandidates = candidates.filter((candidate) => candidate.kind === "plan" && candidate.exists);
    for (const planCandidate of detectedPlanCandidates) {
      for (const inferredSpecPath of inferSiblingSpecPaths(planCandidate.path)) {
        if (seenPaths.has(inferredSpecPath) || !fs.existsSync(inferredSpecPath)) {
          continue;
        }

        const candidate = await buildCandidate({
          cwd: args.cwd,
          rawPath: inferredSpecPath,
          source: "inferred",
          evidence: `inferred from plan artifact: ${planCandidate.path}`,
          confidence: 0.75,
        });
        if (!candidate) {
          continue;
        }

        seenPaths.add(candidate.path);
        candidates.push(candidate);
      }
    }
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
  const handoffPlanCandidate = planCandidates.find((candidate) =>
    candidate.source === "handoff" && (handoffPlanPath ? candidate.path === handoffPlanPath : true),
  ) ?? planCandidates.find((candidate) => candidate.source === "handoff");
  const scratchRelocatedPlanCandidate = planCandidates.find((candidate) =>
    candidate.evidence.includes("relocated from agent scratch dir"),
  );
  const planPath = handoffPlanCandidate
    ? handoffPlanCandidate.path
    : scratchRelocatedPlanCandidate
      ? scratchRelocatedPlanCandidate.path
      : planCandidates.length === 1
        ? planCandidates[0]?.path ?? null
        : null;

  return { specPath, planPath, candidates };
}
