import path from "node:path";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, queuedConversationMessages, runs, workers } from "@/server/db/schema";
import { parseGitBaselineJson } from "@/server/git/auto-commit";
import { extractQuotaResetInfo } from "@/server/quota/reset-parser";
import { readWorkerEntriesTail, readWorkerOutputEntries } from "@/server/workers/output-store";
import type { WorkerEntry } from "@/shared/worker-entries";
import type { HandoffModifiedFile, HandoffVerification } from "@/shared/handoff";
import { redactHandoffText, sanitizeProjectRelativePath } from "./redaction";
import { collectHandoffWorkspaceState } from "./workspace-state";
import { parseSupersededSeqRanges, withoutSupersededEntries } from "@/lib/superseded-entries";

const SOURCE_TAIL_ENTRIES = 160;

export type WorkerEntryCandidates = {
  recentUserMessages: string[];
  recentAssistantSummary: string | null;
  modifiedFiles: HandoffModifiedFile[];
  verification: HandoffVerification[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toolKind(entry: WorkerEntry): string {
  const raw = asRecord(entry.raw);
  const meta = asRecord(raw?._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  return [
    entry.toolKind,
    raw?.kind,
    claudeCode?.toolName,
    raw?.title,
  ].map((value) => typeof value === "string" ? value : "").join(" ").toLowerCase();
}

function isEditToolEntry(entry: WorkerEntry): boolean {
  return /\b(?:edit|write|patch|replace|create)\b/.test(toolKind(entry));
}

function projectRelativeToolPath(value: unknown, projectPath: string): string | null {
  const candidate = nonEmptyString(value);
  if (!candidate) return null;
  const normalizedProject = path.resolve(projectPath);
  if (path.isAbsolute(candidate)) {
    const relative = path.relative(normalizedProject, path.resolve(candidate));
    if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
    return sanitizeProjectRelativePath(relative);
  }
  return sanitizeProjectRelativePath(candidate);
}

function pathCandidates(entry: WorkerEntry): Array<{ value: unknown; changeType?: HandoffModifiedFile["changeType"] }> {
  const raw = asRecord(entry.raw);
  const rawInput = asRecord(raw?.rawInput);
  const meta = asRecord(raw?._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const responseFile = asRecord(toolResponse?.file);
  const result: Array<{ value: unknown; changeType?: HandoffModifiedFile["changeType"] }> = [];
  for (const location of Array.isArray(raw?.locations) ? raw.locations : []) {
    result.push({ value: asRecord(location)?.path });
  }
  for (const value of [
    raw?.path,
    raw?.filePath,
    raw?.file_path,
    raw?.filename,
    rawInput?.path,
    rawInput?.filePath,
    rawInput?.file_path,
    rawInput?.filename,
    responseFile?.filePath,
    responseFile?.file_path,
    toolResponse?.filePath,
  ]) {
    result.push({ value });
  }
  for (const content of Array.isArray(raw?.content) ? raw.content : []) {
    const record = asRecord(content);
    const oldText = record?.oldText;
    const newText = record?.newText;
    const metaKind = nonEmptyString(asRecord(record?._meta)?.kind)?.toLowerCase();
    result.push({
      value: record?.path,
      changeType: oldText === null || metaKind === "add"
        ? "added"
        : newText === null || metaKind === "delete"
          ? "deleted"
          : "modified",
    });
  }
  const rawOutput = asRecord(raw?.rawOutput);
  const changes = asRecord(rawOutput?.changes);
  for (const [target, change] of Object.entries(changes ?? {})) {
    const kind = nonEmptyString(asRecord(change)?.type)?.toLowerCase();
    result.push({
      value: target,
      changeType: kind === "add" || kind === "create"
        ? "added"
        : kind === "delete" || kind === "remove"
          ? "deleted"
          : "modified",
    });
  }
  for (const title of [nonEmptyString(raw?.title), nonEmptyString(entry.text)]) {
    const match = title?.match(/^(?:edit|write|create|patch|replace)\s+(.+)$/i);
    if (match?.[1] && /[/\\]/.test(match[1])) result.push({ value: match[1] });
  }
  return result;
}

const GENERIC_EDIT_EVIDENCE = "A successful persisted edit tool call targeted this file.";

function compactCodeEvidence(value: unknown, maximumCharacters: number): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact ? redactHandoffText(compact, maximumCharacters) : null;
}

function describeEdit(oldValue: unknown, newValue: unknown): string | null {
  const oldText = compactCodeEvidence(oldValue, 100);
  const newText = compactCodeEvidence(newValue, 160);
  if (oldText && newText) return `Changed ${JSON.stringify(oldText)} to ${JSON.stringify(newText)}.`;
  if (newText) return `Added ${JSON.stringify(newText)}.`;
  if (oldText) return `Removed ${JSON.stringify(oldText)}.`;
  return null;
}

function editEvidenceForPath(group: readonly WorkerEntry[], targetPath: string, projectPath: string): string[] {
  const evidence = new Set<string>();
  for (const entry of group) {
    const raw = asRecord(entry.raw);
    for (const content of Array.isArray(raw?.content) ? raw.content : []) {
      const record = asRecord(content);
      if (projectRelativeToolPath(record?.path, projectPath) !== targetPath) continue;
      const description = describeEdit(record?.oldText, record?.newText);
      if (description) evidence.add(description);
    }

    const rawInput = asRecord(raw?.rawInput);
    const inputPath = [rawInput?.path, rawInput?.filePath, rawInput?.file_path, rawInput?.filename]
      .map((value) => projectRelativeToolPath(value, projectPath))
      .find((value) => value === targetPath);
    if (inputPath) {
      const description = describeEdit(
        rawInput?.old_string ?? rawInput?.oldString,
        rawInput?.new_string ?? rawInput?.newString ?? rawInput?.content,
      );
      if (description) evidence.add(description);
    }

    const claudeCode = asRecord(asRecord(raw?._meta)?.claudeCode);
    const response = asRecord(claudeCode?.toolResponse);
    const responsePath = projectRelativeToolPath(
      response?.filePath ?? response?.file_path ?? asRecord(response?.file)?.filePath,
      projectPath,
    );
    if (responsePath === targetPath) {
      const description = describeEdit(response?.oldString ?? response?.old_string, response?.newString ?? response?.new_string);
      if (description) evidence.add(description);
    }
  }
  return [...evidence].slice(0, 8);
}

function mergeChangeType(
  previous: HandoffModifiedFile["changeType"] | undefined,
  next: HandoffModifiedFile["changeType"] | undefined,
): HandoffModifiedFile["changeType"] {
  if (!previous) return next ?? "modified";
  if (!next || next === "modified") return previous;
  if (next === "deleted") return "deleted";
  if (next === "added") return previous === "deleted" ? "modified" : "added";
  return next;
}

function rawCommand(entry: WorkerEntry): string | null {
  const raw = asRecord(entry.raw);
  const rawInput = asRecord(raw?.rawInput);
  const rawOutput = asRecord(raw?.rawOutput);
  for (const value of [rawInput?.command, rawInput?.cmd, raw?.command, raw?.cmd, rawOutput?.command]) {
    if (Array.isArray(value)) {
      const command = value.filter((part): part is string => typeof part === "string").join(" ").trim();
      if (command) return command;
    }
    const command = nonEmptyString(value);
    if (command) return command;
  }
  return null;
}

function isVerificationCommand(command: string): boolean {
  return /\b(?:pnpm|npm|yarn|bun)\s+(?:(?:exec|run)\s+)?(?:vitest|jest|pytest|tsc|eslint|mypy|vite(?:\s+build)?|test(?::[\w-]+)?|build(?::[\w-]+)?|lint(?::[\w-]+)?|typecheck(?::[\w-]+)?|check(?::[\w-]+)?|verify(?::[\w-]+)?)\b/i.test(command)
    || /(?:^|[;&|]\s*)(?:npx\s+)?(?:vitest|jest|pytest|tsc|eslint|mypy|ruff\s+check|biome\s+check|cargo\s+(?:test|check)|go\s+test|make\s+(?:test|check|verify))\b/i.test(command);
}

function rawExitCode(entry: WorkerEntry): number | null {
  const raw = asRecord(entry.raw);
  const rawOutput = asRecord(raw?.rawOutput);
  const meta = asRecord(raw?._meta);
  const terminalExit = asRecord(meta?.terminal_exit);
  for (const value of [rawOutput?.exit_code, rawOutput?.exitCode, terminalExit?.exit_code, terminalExit?.exitCode]) {
    if (typeof value === "number" && Number.isInteger(value)) return value;
  }
  return null;
}

function rawOutputText(entry: WorkerEntry): string | null {
  const raw = asRecord(entry.raw);
  const rawOutput = raw?.rawOutput;
  if (typeof rawOutput === "string") {
    const output = nonEmptyString(rawOutput);
    return output && !/^\([^\n]*completed with no output\)$/i.test(output) ? output : null;
  }
  const outputRecord = asRecord(rawOutput);
  for (const value of [outputRecord?.formatted_output, outputRecord?.aggregated_output]) {
    const output = nonEmptyString(value);
    if (output) return output;
  }
  const stdout = nonEmptyString(outputRecord?.stdout);
  const stderr = nonEmptyString(outputRecord?.stderr);
  if (stdout || stderr) return [stdout, stderr].filter(Boolean).join("\n");
  const meta = asRecord(raw?._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const responseStdout = nonEmptyString(toolResponse?.stdout);
  const responseStderr = nonEmptyString(toolResponse?.stderr);
  return responseStdout || responseStderr
    ? [responseStdout, responseStderr].filter(Boolean).join("\n")
    : null;
}

function verificationResult(args: {
  command: string;
  failed: boolean;
  completed: boolean;
  exitCode: number | null;
  output: string | null;
}): HandoffVerification["result"] {
  const failureEvidence = Boolean(args.output && (
    /(?:^|\n)\s*(?:FAIL\b|Error:|error TS\d+)/m.test(args.output)
    || /\b[1-9]\d*\s+failed\b|\bbuild failed\b|\btypecheck failed\b/i.test(args.output)
  ));
  if (args.failed || (args.exitCode !== null && args.exitCode !== 0) || failureEvidence) return "failed";
  const successEvidence = Boolean(args.output && (
    /\b(?:test files|tests?)\s+\d+\s+passed\b|\bbuilt in \d|\bbuild (?:passed|succeeded|completed)\b|\btypecheck passed\b/i.test(args.output)
  ));
  if (successEvidence) return "passed";
  // Shell pipelines and command lists normally expose only the final
  // process's exit status. Without explicit success output, exit 0 may belong
  // to tail/grep/cleanup rather than the verification command itself.
  if (/[|;]|&&/.test(args.command)) return "unknown";
  return args.completed ? "passed" : "unknown";
}

export function selectWorkerEntryCandidates(
  entries: readonly WorkerEntry[],
  sourceSeq: number | null,
  projectPath = process.cwd(),
): WorkerEntryCandidates {
  const boundedByIdentity = new Map<string, WorkerEntry>();
  for (const entry of entries
    .filter((candidate) => sourceSeq == null || candidate.seq <= sourceSeq)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.seq - right.seq)) {
    boundedByIdentity.set(`${entry.type}:${entry.id}`, entry);
  }
  const bounded = [...boundedByIdentity.values()]
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.seq - right.seq);
  const visible = bounded.filter((entry) => entry.type !== "thought" && entry.type !== "user_message_chunk" && !entry.diagnosticOnly);
  const recentUserMessages = [...new Set(visible
    .filter((entry) => entry.type === "user_input" || entry.authorRole === "user")
    .map((entry) => redactHandoffText(entry.text, 1_500))
    .filter(Boolean))]
    .slice(-6);
  const assistantEntries = visible.filter((entry) => (
    (entry.type === "message" || entry.type === "agent_content")
    && (entry.authorRole === "assistant" || entry.authorRole == null)
    && entry.text.trim()
  ));
  const meaningfulAssistantText = [...new Set(assistantEntries
    .map((entry) => redactHandoffText(entry.text, 1_000))
    .filter(Boolean))]
    .filter((text) => (
      !extractQuotaResetInfo(text).isQuotaError
      && !/\b(?:authorization required|not authenticated|login required|sign-?in required)\b/i.test(text)
    ));
  const toolCalls = new Map<string, WorkerEntry[]>();
  for (const entry of visible.filter((candidate) => candidate.type === "tool_call" || candidate.type === "tool_call_update")) {
    const key = entry.toolCallId?.trim() || `${entry.type}:${entry.id}`;
    const group = toolCalls.get(key) ?? [];
    group.push(entry);
    toolCalls.set(key, group);
  }
  const modifiedByPath = new Map<string, HandoffModifiedFile>();
  const successfulEditCallsByPath = new Map<string, number>();
  const verification: HandoffVerification[] = [];
  for (const group of toolCalls.values()) {
    const statuses = group.map((entry) => entry.status ?? nonEmptyString(asRecord(entry.raw)?.status)).filter(Boolean);
    const failed = statuses.some((status) => /^(?:failed|error|cancelled|canceled)$/i.test(String(status)));
    const completed = statuses.some((status) => /^(?:completed|success|succeeded)$/i.test(String(status)));
    if (completed && !failed && group.some(isEditToolEntry)) {
      const targets = new Map<string, HandoffModifiedFile["changeType"] | undefined>();
      for (const entry of group) {
        for (const candidate of pathCandidates(entry)) {
          const target = projectRelativeToolPath(candidate.value, projectPath);
          if (!target) continue;
          targets.set(target, mergeChangeType(targets.get(target), candidate.changeType));
        }
      }
      for (const [target, changeType] of targets) {
        const previous = modifiedByPath.get(target);
        const semanticEvidence = editEvidenceForPath(group, target, projectPath);
        const previousEvidence = previous?.evidence.filter((item) => item !== GENERIC_EDIT_EVIDENCE) ?? [];
        const evidence = [...new Set([...previousEvidence, ...semanticEvidence])].slice(0, 8);
        modifiedByPath.set(target, {
          path: target,
          changeType: mergeChangeType(previous?.changeType, changeType),
          ownership: "session",
          summary: null,
          evidence: evidence.length > 0 ? evidence : [GENERIC_EDIT_EVIDENCE],
        });
        successfulEditCallsByPath.set(target, (successfulEditCallsByPath.get(target) ?? 0) + 1);
      }
    }
    const command = group.map(rawCommand).find((value): value is string => Boolean(value));
    if (!command || !isVerificationCommand(command) || (!completed && !failed)) continue;
    const exitCode = group.map(rawExitCode).find((value): value is number => value !== null)
      ?? (completed && !failed ? 0 : null);
    const importantOutput = [...group].reverse().map(rawOutputText).find((value): value is string => Boolean(value)) ?? null;
    verification.push({
      command: redactHandoffText(command, 500),
      result: verificationResult({ command, failed, completed, exitCode, output: importantOutput }),
      exitCode,
      importantOutput: importantOutput ? redactHandoffText(importantOutput, 1_000) : null,
    });
  }
  return {
    recentUserMessages,
    recentAssistantSummary: meaningfulAssistantText.length > 0
      ? redactHandoffText(meaningfulAssistantText.slice(-4).join("\n\n"), 3_000) || null
      : null,
    modifiedFiles: [...modifiedByPath.values()]
      .map((file) => {
        const count = successfulEditCallsByPath.get(file.path) ?? 1;
        return {
          ...file,
          summary: `${count} successful edit tool call${count === 1 ? "" : "s"} recorded for this file.`,
        };
      })
      .sort((left, right) => left.path.localeCompare(right.path)),
    verification: verification.slice(-20),
  };
}

export type GatheredHandoffCandidates = {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect | null;
  originalRequest: string | null;
  currentObjective: string | null;
  recentUserMessages: string[];
  recentAssistantSummary: string | null;
  queuedMessages: string[];
  verification: HandoffVerification[];
  workspace: Awaited<ReturnType<typeof collectHandoffWorkspaceState>>;
  sourceSeq: number | null;
  plans: string[];
  specs: string[];
  generatedOutputs: string[];
};

export async function gatherHandoffCandidates(args: {
  runId: string;
  workerId: string | null;
  sourceSeq?: number | null;
  forkedFromMessageId?: string | null;
}): Promise<GatheredHandoffCandidates> {
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  if (!run) throw new Error(`Run ${args.runId} not found.`);
  const worker = args.workerId
    ? await db.select().from(workers).where(and(eq(workers.id, args.workerId), eq(workers.runId, args.runId))).get() ?? null
    : await db.select().from(workers).where(eq(workers.runId, args.runId)).orderBy(desc(workers.updatedAt), desc(workers.id)).limit(1).get() ?? null;

  const projectPath = run.projectPath ?? worker?.cwd ?? process.cwd();
  const tail = worker ? await readWorkerEntriesTail(args.runId, worker.id, SOURCE_TAIL_ENTRIES) : null;
  const sourceSeq = args.sourceSeq ?? tail?.latestSeq ?? (worker ? 0 : null);
  const boundaryMessage = args.forkedFromMessageId
    ? await db.select().from(messages).where(and(eq(messages.id, args.forkedFromMessageId), eq(messages.runId, args.runId))).get()
    : null;
  if (args.forkedFromMessageId && !boundaryMessage) throw new Error("The requested fork message does not belong to the source conversation.");
  const contextWorkers = await db.select().from(workers)
    .where(eq(workers.runId, args.runId))
    .orderBy(asc(workers.createdAt), asc(workers.id));
  const contextEntrySets = await Promise.all(contextWorkers.map(async (contextWorker) => {
    const entries = withoutSupersededEntries(
      await readWorkerOutputEntries(args.runId, contextWorker.id),
      parseSupersededSeqRanges(contextWorker.supersededSeqRanges),
    );
    if (contextWorker.id === worker?.id && sourceSeq !== null) {
      return entries.filter((entry) => entry.seq <= sourceSeq);
    }
    return entries;
  }));
  const allContextEntries = contextEntrySets.flat();
  const forkBoundaryTimestamp = args.forkedFromMessageId
    ? allContextEntries
      .filter((entry) => entry.id === args.forkedFromMessageId && entry.type === "user_input")
      .map((entry) => entry.timestamp)
      .sort()[0] ?? boundaryMessage?.createdAt.toISOString() ?? null
    : null;
  const boundedContextEntries = forkBoundaryTimestamp
    ? allContextEntries.filter((entry) => entry.timestamp <= forkBoundaryTimestamp)
    : allContextEntries;
  const streamCandidates = selectWorkerEntryCandidates(boundedContextEntries, null, projectPath);
  const boundedMessages = (await db.select().from(messages)
    .where(boundaryMessage ? and(eq(messages.runId, args.runId), lte(messages.createdAt, boundaryMessage.createdAt)) : eq(messages.runId, args.runId))
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(80)).reverse();
  const originalUserMessage = await db.select().from(messages)
    .where(and(
      eq(messages.runId, args.runId),
      eq(messages.role, "user"),
      ...(boundaryMessage ? [lte(messages.createdAt, boundaryMessage.createdAt)] : []),
    ))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .limit(1).get();
  const userMessages = boundedMessages.filter((message) => message.role === "user" && !message.supersededAt);
  const assistantMessages = boundedMessages.filter((message) => message.role === "assistant" && !message.supersededAt);
  const pendingQueued = await db.select().from(queuedConversationMessages)
    .where(and(
      eq(queuedConversationMessages.runId, args.runId),
      inArray(queuedConversationMessages.status, ["pending", "delivering"]),
    ))
    .orderBy(asc(queuedConversationMessages.createdAt), asc(queuedConversationMessages.id))
    .limit(20);
  const queuedMessages = pendingQueued.map((message) => redactHandoffText(message.content, 1_000));
  const workspace = await collectHandoffWorkspaceState({
    projectPath,
    baseline: parseGitBaselineJson(run.gitBaselineJson),
  });
  workspace.modifiedFiles = streamCandidates.modifiedFiles;
  let plannerOutputs: string[] = [];
  try {
    const parsed: unknown = run.plannerArtifactsJson ? JSON.parse(run.plannerArtifactsJson) : [];
    if (Array.isArray(parsed)) plannerOutputs = parsed.flatMap((entry) => typeof entry === "string" ? [entry] : entry && typeof entry === "object" && "path" in entry && typeof entry.path === "string" ? [entry.path] : []);
  } catch {
    plannerOutputs = [];
  }

  return {
    run,
    worker,
    originalRequest: originalUserMessage?.content ? redactHandoffText(originalUserMessage.content, 4_000) : worker?.initialPrompt ? redactHandoffText(worker.initialPrompt, 4_000) : null,
    currentObjective: userMessages.at(-1)?.content ? redactHandoffText(userMessages.at(-1)?.content, 2_000) : null,
    recentUserMessages: userMessages.length > 0
      ? userMessages.slice(-6).map((message) => redactHandoffText(message.content, 1_500))
      : streamCandidates.recentUserMessages,
    recentAssistantSummary: streamCandidates.recentAssistantSummary
      ?? (assistantMessages.at(-1)?.content ? redactHandoffText(assistantMessages.at(-1)?.content, 3_000) : null),
    queuedMessages,
    verification: streamCandidates.verification,
    workspace,
    sourceSeq,
    plans: [run.artifactPlanPath].filter((value): value is string => Boolean(value)),
    specs: [run.specPath].filter((value): value is string => Boolean(value)),
    generatedOutputs: plannerOutputs,
  };
}
