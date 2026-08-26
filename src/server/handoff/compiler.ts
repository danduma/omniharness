import { createHash } from "crypto";
import {
  HANDOFF_PACKET_MAX_CHARACTERS,
  HANDOFF_PACKET_VERSION,
  type HandoffModifiedFile,
  type HandoffSummarySource,
  type HandoffTargetSelection,
  type HandoffVerification,
  type HybridHandoffPacketV1,
} from "@/shared/handoff";
import type { SupportedWorkerType } from "@/server/supervisor/worker-types";
import { redactHandoffList, redactHandoffText, sanitizeProjectRelativePath } from "./redaction";

export type CompileHybridHandoffInput = {
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: HandoffTargetSelection;
  projectRootLabel: string;
  authoritative: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria?: string[];
    userConstraints?: string[];
    inProgress?: string[];
    modifiedFiles: HandoffModifiedFile[];
    verification: HandoffVerification[];
    recentUserMessages: string[];
    recentAssistantSummary?: string | null;
    pendingUserInput?: string | null;
    queuedMessages: string[];
    baselineCommit?: string | null;
    currentHead?: string | null;
    dirtyBeforeSession?: boolean | null;
    untrackedFiles?: string[];
    commitsCreated?: string[];
    plans?: string[];
    specs?: string[];
    generatedOutputs?: string[];
  };
  advisory: {
    currentObjective?: string | null;
    completed: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    decisions: Array<{ decision: string; reason?: string | null; evidence?: string[] }>;
    relevantFiles: string[];
    rejectedApproaches?: Array<{ approach: string; reason: string }>;
    summarySource: HandoffSummarySource;
  };
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return typeof value === "string" ? value.normalize("NFC") : value;
}

function contentHash(packet: Omit<HybridHandoffPacketV1, "contentHash">): string {
  const withoutVolatile = {
    ...packet,
    source: { ...packet.source, generatedAt: "" },
  };
  return createHash("sha256").update(JSON.stringify(canonicalize(withoutVolatile))).digest("hex");
}

export function recomputeHybridHandoffContentHash(packet: HybridHandoffPacketV1): string {
  const { contentHash: _ignored, ...payload } = packet;
  return contentHash(payload);
}

function cleanModifiedFiles(files: HandoffModifiedFile[]): HandoffModifiedFile[] {
  return files.flatMap((file) => {
    const safePath = sanitizeProjectRelativePath(file.path);
    if (!safePath) return [];
    return [{
      ...file,
      path: safePath,
      summary: file.summary ? redactHandoffText(file.summary, 500) : null,
      evidence: redactHandoffList(file.evidence, 8, 300),
    }];
  }).sort((left, right) => left.path.localeCompare(right.path)).slice(0, 120);
}

function cleanVerification(values: HandoffVerification[]): HandoffVerification[] {
  return values.slice(0, 30).map((entry) => ({
    ...entry,
    command: redactHandoffText(entry.command, 500),
    importantOutput: entry.importantOutput ? redactHandoffText(entry.importantOutput, 1_000) : null,
  }));
}

export function compileHybridHandoffPacket(input: CompileHybridHandoffInput): HybridHandoffPacketV1 {
  const warnings: string[] = [];
  const authoritativeObjective = redactHandoffText(input.authoritative.currentObjective, 2_000) || null;
  const advisoryObjective = redactHandoffText(input.advisory.currentObjective, 2_000) || null;
  if (authoritativeObjective && advisoryObjective && authoritativeObjective !== advisoryObjective) {
    warnings.push("Advisory objective conflicted with authoritative session state and was ignored.");
  }

  const relevantUnchangedFiles = input.advisory.relevantFiles
    .map(sanitizeProjectRelativePath)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 40);

  const basePacket: Omit<HybridHandoffPacketV1, "contentHash"> = {
    handoffVersion: HANDOFF_PACKET_VERSION,
    source: {
      ...input.source,
      runId: redactHandoffText(input.source.runId, 200),
      workerId: input.source.workerId ? redactHandoffText(input.source.workerId, 200) : null,
    },
    target: { ...input.target },
    task: {
      originalRequest: redactHandoffText(input.authoritative.originalRequest, 4_000) || null,
      currentObjective: authoritativeObjective ?? advisoryObjective,
      acceptanceCriteria: redactHandoffList(input.authoritative.acceptanceCriteria, 30, 500),
      userConstraints: redactHandoffList(input.authoritative.userConstraints, 40, 500),
    },
    state: {
      completed: redactHandoffList(input.advisory.completed, 40, 600),
      inProgress: redactHandoffList(input.authoritative.inProgress, 20, 600),
      remaining: redactHandoffList(input.advisory.remaining, 40, 600),
      blockers: redactHandoffList(input.advisory.blockers, 30, 600),
      openQuestions: redactHandoffList(input.advisory.openQuestions, 30, 600),
      rejectedApproaches: (input.advisory.rejectedApproaches ?? []).slice(0, 20).map((entry) => ({
        approach: redactHandoffText(entry.approach, 500),
        reason: redactHandoffText(entry.reason, 500),
      })),
    },
    decisions: input.advisory.decisions.slice(0, 40).map((entry) => ({
      decision: redactHandoffText(entry.decision, 600),
      reason: entry.reason ? redactHandoffText(entry.reason, 600) : null,
      evidence: redactHandoffList(entry.evidence, 10, 300),
    })),
    workspace: {
      projectRootLabel: redactHandoffText(input.projectRootLabel, 200),
      baselineCommit: input.authoritative.baselineCommit ?? null,
      currentHead: input.authoritative.currentHead ?? null,
      dirtyBeforeSession: input.authoritative.dirtyBeforeSession ?? null,
      modifiedFiles: cleanModifiedFiles(input.authoritative.modifiedFiles),
      untrackedFiles: (input.authoritative.untrackedFiles ?? []).map(sanitizeProjectRelativePath).filter((value): value is string => Boolean(value)).sort().slice(0, 80),
      relevantUnchangedFiles,
      commitsCreated: redactHandoffList(input.authoritative.commitsCreated, 40, 100),
    },
    verification: cleanVerification(input.authoritative.verification),
    artifacts: {
      plans: redactHandoffList(input.authoritative.plans, 20, 500),
      specs: redactHandoffList(input.authoritative.specs, 20, 500),
      generatedOutputs: redactHandoffList(input.authoritative.generatedOutputs, 20, 500),
    },
    continuity: {
      recentUserMessages: (input.authoritative.recentUserMessages ?? []).slice(-6).map((value) => redactHandoffText(value, 1_500)),
      recentAssistantSummary: input.authoritative.recentAssistantSummary ? redactHandoffText(input.authoritative.recentAssistantSummary, 3_000) : null,
      pendingUserInput: input.authoritative.pendingUserInput ? redactHandoffText(input.authoritative.pendingUserInput, 1_500) : null,
      queuedMessages: (input.authoritative.queuedMessages ?? []).slice(0, 12).map((value) => redactHandoffText(value, 1_000)),
    },
    provenance: {
      summarySource: input.advisory.summarySource,
      omittedSections: [],
      confidenceWarnings: warnings,
      truncatedFields: [],
    },
  };

  const truncations = new Set<string>();
  const mark = (field: string) => {
    truncations.add(field);
    basePacket.provenance.truncatedFields = [...truncations].sort();
  };
  const serializedLength = () => JSON.stringify(basePacket).length;
  const dropFrom = <T>(field: string, values: T[], minimum = 0) => {
    if (values.length <= minimum) return false;
    values.pop();
    mark(field);
    return true;
  };
  const reducers: Array<() => boolean> = [
    () => dropFrom("workspace.relevantUnchangedFiles", basePacket.workspace.relevantUnchangedFiles),
    () => dropFrom("state.completed", basePacket.state.completed),
    () => dropFrom("decisions", basePacket.decisions),
    () => dropFrom("continuity.queuedMessages", basePacket.continuity.queuedMessages),
    () => dropFrom("verification", basePacket.verification),
    () => dropFrom("workspace.untrackedFiles", basePacket.workspace.untrackedFiles),
    () => dropFrom("artifacts.generatedOutputs", basePacket.artifacts.generatedOutputs),
    () => dropFrom("artifacts.specs", basePacket.artifacts.specs),
    () => dropFrom("artifacts.plans", basePacket.artifacts.plans),
    () => dropFrom("continuity.recentUserMessages", basePacket.continuity.recentUserMessages, 1),
    () => dropFrom("workspace.modifiedFiles", basePacket.workspace.modifiedFiles, 1),
    () => dropFrom("state.openQuestions", basePacket.state.openQuestions),
    () => dropFrom("state.rejectedApproaches", basePacket.state.rejectedApproaches),
    () => dropFrom("state.blockers", basePacket.state.blockers),
    () => dropFrom("state.remaining", basePacket.state.remaining, 1),
  ];
  while (serializedLength() > HANDOFF_PACKET_MAX_CHARACTERS && reducers.some((reduce) => reduce())) {
    // Each pass removes one entry from every populated section in priority order.
  }
  if (serializedLength() > HANDOFF_PACKET_MAX_CHARACTERS && basePacket.continuity.recentAssistantSummary) {
    basePacket.continuity.recentAssistantSummary = null;
    mark("continuity.recentAssistantSummary");
  }
  if (serializedLength() > HANDOFF_PACKET_MAX_CHARACTERS) {
    basePacket.task.originalRequest = basePacket.task.originalRequest?.slice(0, 1_000) ?? null;
    basePacket.task.currentObjective = basePacket.task.currentObjective?.slice(0, 1_000) ?? null;
    mark("task.originalRequest");
    mark("task.currentObjective");
  }
  if (serializedLength() > HANDOFF_PACKET_MAX_CHARACTERS) {
    throw new Error("The handoff packet could not be reduced to its hard character budget.");
  }

  return { ...basePacket, contentHash: contentHash(basePacket) };
}

function compactLines(values: readonly string[], maximumItems: number, maximumCharacters = 320): string[] {
  return values.slice(0, maximumItems).map((value) => `- ${redactHandoffText(value, maximumCharacters)}`);
}

function appendSection(lines: string[], title: string, values: readonly string[], maximumItems: number, maximumCharacters = 320) {
  const compact = compactLines(values, maximumItems, maximumCharacters);
  if (compact.length === 0) return;
  lines.push("", `## ${title}`, "", ...compact);
  if (values.length > compact.length) lines.push(`- …and ${values.length - compact.length} more recorded item${values.length - compact.length === 1 ? "" : "s"}.`);
}

export function renderHybridHandoffSeed(packet: HybridHandoffPacketV1, _requestedNonce?: string): string {
  if (JSON.stringify(packet).length > HANDOFF_PACKET_MAX_CHARACTERS) {
    throw new Error("Refusing to render an oversized handoff packet.");
  }
  const objective = packet.task.currentObjective ?? packet.task.originalRequest ?? "Continue the previous task";
  const lines = [
    `# Continuation brief: ${redactHandoffText(objective, 140)}`,
    "",
    "This brief was generated from the previous conversation and workspace. Verify current files and runtime state before making changes.",
  ];
  if (packet.task.originalRequest) lines.push("", "## Original request", "", redactHandoffText(packet.task.originalRequest, 1_200));
  if (packet.task.currentObjective) lines.push("", "## Current objective", "", redactHandoffText(packet.task.currentObjective, 900));
  appendSection(lines, "Completed", packet.state.completed, 6);
  appendSection(lines, "Work in progress", packet.state.inProgress, 5);
  appendSection(lines, "Remaining work", packet.state.remaining, 8);
  appendSection(lines, "Blockers", packet.state.blockers, 5);
  appendSection(lines, "Open questions", packet.state.openQuestions, 5);
  if (packet.continuity.recentAssistantSummary) {
    lines.push("", "## Previous useful context", "", redactHandoffText(packet.continuity.recentAssistantSummary, 1_400));
  }
  appendSection(lines, "Recent user requests", packet.continuity.recentUserMessages, 4, 500);
  const files = [
    ...packet.workspace.modifiedFiles.map((file) => `${file.path} (${file.changeType})`),
    ...packet.workspace.relevantUnchangedFiles,
  ];
  appendSection(lines, "Relevant files", files, 20, 180);
  appendSection(lines, "Verification", packet.verification.map((record) => `${record.command}: ${record.result}${record.importantOutput ? ` — ${record.importantOutput}` : ""}`), 8, 360);
  appendSection(lines, "Decisions", packet.decisions.map((decision) => `${decision.decision}${decision.reason ? ` — ${decision.reason}` : ""}`), 6, 360);
  lines.push("", "Continue the current objective. Do not redo completed work unless the repository state contradicts this brief.");
  return redactHandoffText(lines.join("\n"), 11_500);
}
