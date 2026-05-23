import type { WorkerEntryChannel, WorkerEntryType } from "@/server/workers/entries-types";

export interface AgentOutputEntry {
  id: string;
  seq?: number;
  type: WorkerEntryType;
  text: string;
  timestamp: string;
  toolCallId?: string | null;
  toolKind?: string | null;
  status?: string | null;
  raw?: unknown;
  authorRole?: string | null;
  channel?: WorkerEntryChannel;
}

export interface AgentOutputPane {
  label: "IN" | "OUT" | "DIFF";
  text: string;
  kind?: "text" | "diff";
}

const TERMINAL_TOOL_STATUSES = new Set(["completed", "failed", "cancelled", "canceled", "done", "error"]);
const RUNNING_TOOL_STATUSES = new Set(["pending", "in_progress", "working"]);
const ACTIVE_THINKING_AGENT_STATES = new Set(["starting", "working", "recovering"]);
const FALLBACK_TOOL_TITLE_PATTERN = /^Tool call(?:\s+\S+)?\s+(?:updated|completed|failed|cancelled|canceled|done|error|pending|in_progress|working)(?::.*)?$/i;

export type AgentToolActivityKind = "read" | "bash" | "agent" | "edit" | "search" | "tool";

export type AgentToolActivity = {
  id: string;
  kind: "tool";
  actionKind: AgentToolActivityKind;
  label: string;
  title: string;
  status: string;
  timestamp: string;
  targetPath?: string | null;
  inputPane?: AgentOutputPane;
  outputPane?: AgentOutputPane;
};

export type AgentToolGroupCounts = {
  editedFiles: number;
  readFiles: number;
  searches: number;
  commands: number;
  agents: number;
  tools: number;
  total: number;
};

export type AgentActivityItem =
  | {
      id: string;
      kind: "message";
      text: string;
      timestamp: string;
      live?: boolean;
    }
  | {
      id: string;
      kind: "thinking";
      thoughts: string[];
      timestamp: string;
      inProgress: boolean;
      durationMs?: number;
    }
  | AgentToolActivity
  | {
      id: string;
      kind: "tool_group";
      status: string;
      timestamp: string;
      counts: AgentToolGroupCounts;
      tools: AgentToolActivity[];
    }
  | {
      id: string;
      kind: "permission";
      title: string;
      text: string;
      detail?: string | null;
      timestamp: string;
      status: string;
    }
  | {
      id: string;
      kind: "work_summary";
      durationMs: number;
      timestamp: string;
      inProgress: boolean;
      items: AgentActivityItem[];
    };

type AgentOutputSnapshot = {
  outputEntries?: AgentOutputEntry[] | null;
  state?: string | null;
  currentText?: string | null;
  lastText?: string | null;
  displayText?: string | null;
};

type MutableToolActivity = Extract<AgentActivityItem, { kind: "tool" }>;
type MutableThinkingActivity = Extract<AgentActivityItem, { kind: "thinking" }>;
type MutablePermissionActivity = Extract<AgentActivityItem, { kind: "permission" }>;
type MutableMessageActivity = Extract<AgentActivityItem, { kind: "message" }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isOmittedOutputEntriesMarker(entry: AgentOutputEntry) {
  return entry.id === "output-archive-marker" || entry.id.startsWith("output-entries-omitted:");
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function shouldKeepTrailingThinkingOpen(snapshot: AgentOutputSnapshot) {
  const state = snapshot.state?.trim().toLowerCase();
  if (!state) {
    return true;
  }

  if (!ACTIVE_THINKING_AGENT_STATES.has(state)) {
    return false;
  }

  return true;
}

function unwrapCodeFence(value: string): { text: string; language?: string } {
  const normalized = normalizeMultilineText(value).trim();
  const match = normalized.match(/^```([a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```$/);
  if (!match) {
    return { text: normalized };
  }

  return {
    text: match[2] ?? "",
    language: match[1] || undefined,
  };
}

function stripLineNumbersIfNeeded(value: string): string {
  const lines = value.split("\n");
  const contentLines = lines.filter((line) => line.trim().length > 0);
  if (contentLines.length < 2) {
    return value;
  }

  const numberedLines = contentLines.filter((line) => /^\s*\d+\s{2,}\S/.test(line)).length;
  if (numberedLines < Math.max(2, Math.ceil(contentLines.length * 0.5))) {
    return value;
  }

  return lines.map((line) => line.replace(/^\s*\d+\s{2,}/, "")).join("\n");
}

function cleanPaneText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const unfenced = unwrapCodeFence(value);
  const stripped = stripLineNumbersIfNeeded(unfenced.text)
    .replace(/^\n+/, "")
    .replace(/\n+$/, "");

  return stripped.trim().length > 0 ? stripped : null;
}

function extractLegacyWorkerResponse(value: string | null | undefined): string | null {
  const text = normalizeMultilineText(value ?? "");
  const match = text.match(/(?:^|\n\n)(?:Initial response|Response):\n([\s\S]*)$/i);
  return cleanPaneText(match?.[1] ?? text);
}

export function extractLatestPlainTextTurn(snapshot: AgentOutputSnapshot): string {
  const outputEntries = Array.isArray(snapshot.outputEntries) ? snapshot.outputEntries : [];

  for (let index = outputEntries.length - 1; index >= 0; index -= 1) {
    const entry = outputEntries[index];
    if (entry?.type !== "message" || isOmittedOutputEntriesMarker(entry)) {
      continue;
    }

    const text = cleanPaneText(entry.text);
    if (text) {
      return text;
    }
  }

  return extractLegacyWorkerResponse(snapshot.currentText)
    || extractLegacyWorkerResponse(snapshot.lastText)
    || "";
}

function stringifyUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value == null) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function outputEntryFingerprint(entry: AgentOutputEntry): string {
  return JSON.stringify(entry);
}

function isFragmentedMessageCandidate(entry: AgentOutputEntry) {
  if (entry.type !== "message" || entry.toolCallId || entry.status) {
    return false;
  }
  const text = entry.text ?? "";
  return text.length > 0 && text.length <= 24;
}

function hasFragmentedMessageEvidence(entries: AgentOutputEntry[]) {
  if (entries.length < 4) {
    return false;
  }

  const totalLength = entries.reduce((sum, entry) => sum + (entry.text?.length ?? 0), 0);
  if (totalLength < 32) {
    return false;
  }

  return entries.some((entry) => {
    const text = entry.text ?? "";
    return /^\s/.test(text)
      || /\s$/.test(text)
      || /^[`.,:;!?()[\]{}<>=+\-_/\\\n]/.test(text);
  });
}

function mergeFragmentedMessageRun(entries: AgentOutputEntry[]) {
  const first = entries[0]!;
  const last = entries[entries.length - 1]!;
  return {
    ...first,
    id: `message-fragment-run:${first.id}:${last.id}`,
    text: entries.map((entry) => normalizeMultilineText(entry.text ?? "")).join(""),
    timestamp: first.timestamp,
  } satisfies AgentOutputEntry;
}

function coalesceFragmentedMessageEntries(entries: AgentOutputEntry[]) {
  const coalesced: AgentOutputEntry[] = [];
  let pending: AgentOutputEntry[] = [];

  const flush = () => {
    if (pending.length === 0) {
      return;
    }
    if (hasFragmentedMessageEvidence(pending)) {
      coalesced.push(mergeFragmentedMessageRun(pending));
    } else {
      coalesced.push(...pending);
    }
    pending = [];
  };

  for (const entry of entries) {
    if (isFragmentedMessageCandidate(entry)) {
      pending.push(entry);
      continue;
    }
    flush();
    coalesced.push(entry);
  }

  flush();
  return coalesced;
}

function stringifyToolRawOutput(value: unknown): string | null {
  const rawOutput = asRecord(value);
  if (rawOutput && typeof rawOutput.formatted_output === "string") {
    return asNonEmptyString(rawOutput.formatted_output);
  }

  return stringifyUnknown(value);
}

function extractContentText(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const parts = value
    .map((item) => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }

      const nested = asRecord(record.content);
      if (record.type === "content" && nested?.type === "text" && typeof nested.text === "string") {
        return nested.text;
      }

      if (typeof record.text === "string") {
        return record.text;
      }

      return null;
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function extractPrimaryPath(raw: Record<string, unknown> | null): string | null {
  if (!raw) {
    return null;
  }

  const locations = Array.isArray(raw.locations) ? raw.locations : [];
  for (const location of locations) {
    const record = asRecord(location);
    const path = asNonEmptyString(record?.path);
    if (path) {
      return path;
    }
  }

  const rawInput = asRecord(raw.rawInput);
  const meta = asRecord(raw._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const responseFile = asRecord(toolResponse?.file);
  const candidates = [
    raw.path,
    raw.filePath,
    raw.file_path,
    raw.filename,
    rawInput?.path,
    rawInput?.filePath,
    rawInput?.file_path,
    rawInput?.filename,
    responseFile?.filePath,
    responseFile?.file_path,
  ];

  for (const candidate of candidates) {
    const path = asNonEmptyString(candidate);
    if (path) {
      return path;
    }
  }

  return null;
}

function basenamePath(value: string): string {
  const segments = value.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || value;
}

function pathFromToolTitle(value: string): string | null {
  const match = value.match(/^(?:Edit|Read|Open|View|Write|Create)\s+(.+)$/i);
  const path = match?.[1]?.trim();
  return path && /[/\\]/.test(path) ? path : null;
}

function extractToolTargetPath(raw: Record<string, unknown> | null, kind: AgentToolActivityKind, baseTitle: string): string | null {
  if (kind !== "read" && kind !== "edit") {
    return null;
  }

  return extractPrimaryPath(raw) || pathFromToolTitle(baseTitle);
}

function truncateInline(value: string, maxLength = 88): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}...`;
}

function summarizePromptLikeInput(raw: Record<string, unknown> | null): string | null {
  if (!raw) {
    return null;
  }

  const rawInput = asRecord(raw.rawInput);
  const firstContentText = extractContentText(raw.content);
  const candidates = [
    rawInput?.description,
    rawInput?.command,
    rawInput?.cmd,
    rawInput?.prompt,
    rawInput?.text,
    rawInput?.description_text,
    raw.command,
    raw.cmd,
    raw.prompt,
    raw.text,
    raw.description,
    firstContentText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeMultilineText(candidate).trim();
    }
  }

  return null;
}

function extractCommandLikeInput(raw: Record<string, unknown> | null): string | null {
  if (!raw) {
    return null;
  }

  const rawInput = asRecord(raw.rawInput);
  const candidates = [
    rawInput?.command,
    rawInput?.cmd,
    raw.command,
    raw.cmd,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeMultilineText(candidate).trim();
    }
  }

  return null;
}

function extractDescriptionLikeInput(raw: Record<string, unknown> | null): string | null {
  if (!raw) {
    return null;
  }

  const rawInput = asRecord(raw.rawInput);
  const firstContentText = extractContentText(raw.content);
  const candidates = [
    rawInput?.description,
    raw.description,
    firstContentText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return normalizeMultilineText(candidate).trim();
    }
  }

  return null;
}

function pathPrefixForDiff(path: string | null, diff: string): string {
  if (!path || /^(?:diff --|--- |\+\+\+ )/m.test(diff) || diff.includes(path)) {
    return "";
  }
  return `diff -- ${path}\n`;
}

function stringLooksLikeDiff(value: string): boolean {
  const normalized = normalizeMultilineText(value).trim();
  return normalized.length > 0 && (
    /^@@\s/m.test(normalized)
    || /^diff --/m.test(normalized)
    || /^\*\*\* (?:Begin Patch|Update File|Add File|Delete File)/m.test(normalized)
  );
}

function extractStringDiff(value: unknown): string | null {
  if (typeof value !== "string" || !stringLooksLikeDiff(value)) {
    return null;
  }

  return normalizeMultilineText(value).trim();
}

function buildLineDiff(path: string | null, marker: "+" | "-", value: unknown, label: string): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeMultilineText(value);
  if (normalized.length === 0) {
    return null;
  }

  const lines = normalized.split("\n").map((line) => `${marker}${line}`).join("\n");
  return `${pathPrefixForDiff(path, "")}@@ ${label} @@\n${lines}`;
}

type ReplacementDiffOp = {
  kind: "context" | "remove" | "add";
  text: string;
  oldLine?: number;
  newLine?: number;
};

const REPLACEMENT_DIFF_CONTEXT_LINES = 1;
const REPLACEMENT_DIFF_MAX_LCS_CELLS = 1_500_000;

function buildFallbackReplacementDiff(path: string | null, oldString: string, newString: string): string {
  const removed = oldString.split("\n").map((line) => `-${line}`).join("\n");
  const added = newString.split("\n").map((line) => `+${line}`).join("\n");
  return `${pathPrefixForDiff(path, "")}@@ -1,${oldString.split("\n").length} +1,${newString.split("\n").length} @@\n${removed}\n${added}`;
}

function diffReplacementLines(oldLines: string[], newLines: string[]): ReplacementDiffOp[] | null {
  const width = newLines.length + 1;
  const cells = (oldLines.length + 1) * width;
  if (cells > REPLACEMENT_DIFF_MAX_LCS_CELLS) {
    return null;
  }

  const table = new Uint32Array(cells);
  const at = (oldIndex: number, newIndex: number) => oldIndex * width + newIndex;

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex -= 1) {
      table[at(oldIndex, newIndex)] = oldLines[oldIndex] === newLines[newIndex]
        ? table[at(oldIndex + 1, newIndex + 1)] + 1
        : Math.max(table[at(oldIndex + 1, newIndex)], table[at(oldIndex, newIndex + 1)]);
    }
  }

  const ops: ReplacementDiffOp[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  let oldLine = 1;
  let newLine = 1;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      ops.push({ kind: "context", text: oldLines[oldIndex], oldLine, newLine });
      oldIndex += 1;
      newIndex += 1;
      oldLine += 1;
      newLine += 1;
      continue;
    }

    if (table[at(oldIndex + 1, newIndex)] >= table[at(oldIndex, newIndex + 1)]) {
      ops.push({ kind: "remove", text: oldLines[oldIndex], oldLine });
      oldIndex += 1;
      oldLine += 1;
    } else {
      ops.push({ kind: "add", text: newLines[newIndex], newLine });
      newIndex += 1;
      newLine += 1;
    }
  }

  while (oldIndex < oldLines.length) {
    ops.push({ kind: "remove", text: oldLines[oldIndex], oldLine });
    oldIndex += 1;
    oldLine += 1;
  }

  while (newIndex < newLines.length) {
    ops.push({ kind: "add", text: newLines[newIndex], newLine });
    newIndex += 1;
    newLine += 1;
  }

  return ops;
}

function replacementDiffHunks(ops: ReplacementDiffOp[], contextLines = REPLACEMENT_DIFF_CONTEXT_LINES): ReplacementDiffOp[][] {
  const changedIndexes = ops
    .map((op, index) => (op.kind === "context" ? -1 : index))
    .filter((index) => index >= 0);

  if (changedIndexes.length === 0) {
    return [];
  }

  const ranges: Array<{ start: number; end: number }> = [];
  for (const index of changedIndexes) {
    const start = Math.max(0, index - contextLines);
    const end = Math.min(ops.length, index + contextLines + 1);
    const last = ranges[ranges.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      ranges.push({ start, end });
    }
  }

  return ranges.map((range) => ops.slice(range.start, range.end));
}

function formatHunkRange(start: number, count: number): string {
  return count === 1 ? `${start}` : `${start},${count}`;
}

function hunkHeader(hunk: ReplacementDiffOp[]): string {
  const oldLines = hunk.filter((op) => op.kind !== "add");
  const newLines = hunk.filter((op) => op.kind !== "remove");
  const firstOld = oldLines[0]?.oldLine ?? hunk[0]?.oldLine ?? 1;
  const firstNew = newLines[0]?.newLine ?? hunk[0]?.newLine ?? 1;
  return `@@ -${formatHunkRange(firstOld, oldLines.length)} +${formatHunkRange(firstNew, newLines.length)} @@`;
}

function formatReplacementDiffOp(op: ReplacementDiffOp): string {
  if (op.kind === "add") {
    return `+${op.text}`;
  }
  if (op.kind === "remove") {
    return `-${op.text}`;
  }
  return ` ${op.text}`;
}

function collectChangeDiffs(value: unknown): string[] {
  const changes = asRecord(value);
  if (!changes) {
    return [];
  }

  return Object.entries(changes)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([path, change]) => {
      const record = asRecord(change);
      const diff = extractStringDiff(record?.unified_diff)
        || extractStringDiff(record?.diff)
        || extractStringDiff(record?.patch);
      if (diff) {
        return [`${pathPrefixForDiff(path, diff)}${diff}`];
      }

      if (record?.type === "add") {
        const addDiff = buildLineDiff(path, "+", record.content, "add");
        return addDiff ? [addDiff] : [];
      }

      if (record?.type === "delete") {
        const deleteDiff = buildLineDiff(path, "-", record.content, "delete");
        return deleteDiff ? [deleteDiff] : [];
      }

      return [];
    });
}

function buildReplacementDiffFromStrings(path: string | null, oldValue: unknown, newValue: unknown): string | null {
  const oldString = typeof oldValue === "string" ? normalizeMultilineText(oldValue) : null;
  const newString = typeof newValue === "string" ? normalizeMultilineText(newValue) : null;
  if (oldString == null || newString == null || oldString === newString) {
    return null;
  }

  const oldLines = oldString.split("\n");
  const newLines = newString.split("\n");
  const ops = diffReplacementLines(oldLines, newLines);
  if (!ops) {
    return buildFallbackReplacementDiff(path, oldString, newString);
  }

  const hunks = replacementDiffHunks(ops);
  if (hunks.length === 0) {
    return null;
  }

  const hunkText = hunks
    .map((hunk) => [
      hunkHeader(hunk),
      ...hunk.map(formatReplacementDiffOp),
    ].join("\n"))
    .join("\n");

  return `${pathPrefixForDiff(path, "")}${hunkText}`;
}

function buildReplacementDiff(rawInput: Record<string, unknown> | null): string | null {
  if (!rawInput) {
    return null;
  }

  return buildReplacementDiffFromStrings(
    extractPrimaryPath({ rawInput }),
    rawInput.old_string,
    rawInput.new_string,
  );
}

function collectContentDiffs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const record = asRecord(item);
    if (!record) {
      return [];
    }

    const nested = asRecord(record.content);
    const diff = extractStringDiff(nested?.text) || extractStringDiff(record.text);
    if (diff) {
      return [diff];
    }

    const contentKind = asNonEmptyString(record.type) || asNonEmptyString(asRecord(record._meta)?.kind);
    if (contentKind === "diff" || contentKind === "modify") {
      const replacementDiff = buildReplacementDiffFromStrings(
        asNonEmptyString(record.path),
        record.oldText,
        record.newText,
      );
      if (replacementDiff) {
        return [replacementDiff];
      }

      const addDiff = buildLineDiff(asNonEmptyString(record.path), "+", record.newText, "add");
      if (addDiff) {
        return [addDiff];
      }

      const deleteDiff = buildLineDiff(asNonEmptyString(record.path), "-", record.oldText, "delete");
      return deleteDiff ? [deleteDiff] : [];
    }

    return [];
  });
}

function extractToolDiff(raw: Record<string, unknown> | null, contentText?: string | null): string | null {
  if (!raw) {
    return null;
  }

  const rawInput = asRecord(raw.rawInput);
  const rawOutput = asRecord(raw.rawOutput);
  const diffs = [
    ...collectChangeDiffs(rawOutput?.changes),
    ...collectChangeDiffs(rawInput?.changes),
    ...collectContentDiffs(raw.content),
  ];

  for (const candidate of [
    rawOutput?.unified_diff,
    rawOutput?.diff,
    rawOutput?.patch,
    rawInput?.unified_diff,
    rawInput?.diff,
    rawInput?.patch,
    rawInput?.text,
    contentText ?? null,
  ]) {
    const diff = extractStringDiff(candidate);
    if (diff) {
      diffs.push(diff);
    }
  }

  const replacementDiff = buildReplacementDiff(rawInput);
  if (replacementDiff) {
    diffs.push(replacementDiff);
  }

  const uniqueDiffs = [...new Set(diffs)];
  return uniqueDiffs.length > 0 ? uniqueDiffs.join("\n\n") : null;
}

function normalizeToolKind(toolKind: string | null | undefined, title: string): AgentToolActivityKind {
  const haystack = `${toolKind ?? ""} ${title}`.toLowerCase();
  if (/\b(read|open|view)\b/.test(haystack)) {
    return "read";
  }
  if (/\b(agent|delegate|dispatch|spawn|worker)\b/.test(haystack)) {
    return "agent";
  }
  if (/\b(edit|write|replace|patch|create)\b/.test(haystack)) {
    return "edit";
  }
  if (/\b(execute|terminal|shell|bash|command|run)\b/.test(haystack)) {
    return "bash";
  }
  if (/\b(search|find|grep|glob)\b/.test(haystack)) {
    return "search";
  }
  return "tool";
}

function toolLabel(kind: AgentToolActivityKind): string {
  switch (kind) {
    case "read":
      return "Read";
    case "bash":
      return "Bash";
    case "agent":
      return "Agent";
    case "edit":
      return "Edit";
    case "search":
      return "Search";
    default:
      return "Tool";
  }
}

function deriveToolTitle(entry: AgentOutputEntry): string {
  const raw = asRecord(entry.raw);
  const rawTitle = asNonEmptyString(raw?.title);
  const baseTitle = rawTitle || entry.text || "Tool activity";
  const kind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), baseTitle);
  const primaryPath = extractPrimaryPath(raw);
  const promptLike = extractDescriptionLikeInput(raw) || summarizePromptLikeInput(raw);

  if ((kind === "read" || kind === "edit") && primaryPath) {
    return basenamePath(primaryPath);
  }

  const titlePath = kind === "read" || kind === "edit" ? pathFromToolTitle(baseTitle) : null;
  if (titlePath) {
    return basenamePath(titlePath);
  }

  if ((kind === "bash" || kind === "agent") && promptLike) {
    return truncateInline(promptLike);
  }

  if (primaryPath) {
    return basenamePath(primaryPath);
  }

  return truncateInline(baseTitle);
}

function deriveToolInputPane(entry: AgentOutputEntry): AgentOutputPane | undefined {
  const raw = asRecord(entry.raw);
  const kind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), asNonEmptyString(raw?.title) || entry.text || "");
  const promptLike = extractCommandLikeInput(raw) || summarizePromptLikeInput(raw);

  if (!promptLike) {
    return undefined;
  }

  if (kind === "bash") {
    const text = cleanPaneText(promptLike);
    return text ? { label: "IN", text } : undefined;
  }

  return undefined;
}

function extractSummaryTail(entry: AgentOutputEntry): string | null {
  const colonIndex = entry.text.indexOf(":");
  if (colonIndex === -1) {
    return null;
  }
  return entry.text.slice(colonIndex + 1).trim();
}

function deriveToolOutputPane(entry: AgentOutputEntry): AgentOutputPane | undefined {
  const raw = asRecord(entry.raw);
  const kind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), asNonEmptyString(raw?.title) || entry.text || "");
  const meta = asRecord(raw?._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const file = asRecord(toolResponse?.file);
  const stdout = asNonEmptyString(toolResponse?.stdout);
  const stderr = asNonEmptyString(toolResponse?.stderr);
  const rawOutput = raw ? raw.rawOutput : undefined;
  const contentText = extractContentText(raw?.content);
  const rawOutputText = stringifyToolRawOutput(rawOutput);
  const metaOutputText = stringifyUnknown(file?.content) || stdout || stderr;
  const summaryTail = extractSummaryTail(entry);
  const isTerminal = entry.status ? TERMINAL_TOOL_STATUSES.has(entry.status) : false;
  const structuredDiffText = extractToolDiff(raw);
  const diffText = structuredDiffText || (kind === "edit" ? extractToolDiff(raw, contentText) : null);

  if (diffText) {
    return { label: "DIFF", text: diffText, kind: "diff" };
  }

  if (!isTerminal && !metaOutputText && !rawOutputText) {
    return undefined;
  }

  const text = cleanPaneText(metaOutputText || contentText || rawOutputText || summaryTail);

  return text ? { label: "OUT", text, kind: "text" } : undefined;
}

function normalizeStatus(value: string | null | undefined, fallback = "pending"): string {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : fallback;
}

function permissionTitleKeyForStatus(status: string) {
  if (status === "approved") {
    return "terminal.permission.approved";
  }
  if (status === "denied") {
    return "terminal.permission.denied";
  }
  if (status === "cancelled" || status === "canceled") {
    return "terminal.permission.cancelled";
  }
  return "terminal.permission.requested";
}

function permissionRequestId(entry: AgentOutputEntry): number | null {
  const raw = asRecord(entry.raw);
  const requestId = raw?.requestId;
  if (typeof requestId === "number" && Number.isFinite(requestId)) {
    return requestId;
  }
  const match = entry.text.match(/\brequest\s+(\d+)\b/i);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function permissionToolCallDetail(entry: AgentOutputEntry): string | null {
  const raw = asRecord(entry.raw);
  const toolCall = asRecord(raw?.toolCall);
  if (toolCall) {
    const title = asNonEmptyString(toolCall.title);
    const kind = asNonEmptyString(toolCall.kind);
    if (title && kind) {
      return `${kind}: ${title}`;
    }
    return title ?? kind;
  }

  const requestedTarget = entry.text.match(/^Permission requested for\s+(.+?)(?::\s*(?:allow|reject|proceed)[\w-]*\b.*)?$/i);
  return requestedTarget?.[1]?.trim() || null;
}

function permissionDisplayText(entry: AgentOutputEntry, detail: string | null | undefined): string {
  if (detail || /^Permission (?:requested|approved|denied|cancelled|canceled)\b/i.test(entry.text)) {
    return "";
  }
  return normalizeMultilineText(entry.text || "").trim();
}

function isFinalToolStatus(value: string | null | undefined): boolean {
  return value ? TERMINAL_TOOL_STATUSES.has(value.trim().toLowerCase()) : false;
}

function mergeToolStatus(currentStatus: string, nextStatus: string | null | undefined): string {
  const normalizedNext = normalizeStatus(nextStatus, currentStatus);
  if (isFinalToolStatus(currentStatus) && !isFinalToolStatus(normalizedNext)) {
    return currentStatus;
  }
  return normalizedNext;
}

function isFailedToolStatus(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "failed" || normalized === "error" || normalized === "cancelled" || normalized === "canceled";
}

function isReplaceableToolTitle(value: string): boolean {
  return ["Tool activity", "Terminal", "Read File", "Execute", "Bash"].includes(value)
    || FALLBACK_TOOL_TITLE_PATTERN.test(value);
}

function createToolActivity(entry: AgentOutputEntry): MutableToolActivity {
  const raw = asRecord(entry.raw);
  const baseTitle = asNonEmptyString(raw?.title) || entry.text || "Tool activity";
  const kind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), baseTitle);

  return {
    id: entry.toolCallId || entry.id,
    kind: "tool",
    actionKind: kind,
    label: toolLabel(kind),
    title: deriveToolTitle(entry),
    status: normalizeStatus(entry.status),
    timestamp: entry.timestamp,
    targetPath: extractToolTargetPath(raw, kind, baseTitle),
    inputPane: deriveToolInputPane(entry),
    outputPane: deriveToolOutputPane(entry),
  };
}

function applyToolUpdate(target: MutableToolActivity, entry: AgentOutputEntry): void {
  target.status = mergeToolStatus(target.status, entry.status);
  const raw = asRecord(entry.raw);
  const baseTitle = asNonEmptyString(raw?.title) || entry.text || "Tool activity";
  const incomingKind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), baseTitle);
  const incomingLabel = toolLabel(incomingKind);
  if (target.label === "Tool" && incomingLabel !== "Tool") {
    target.label = incomingLabel;
  }
  if (target.actionKind === "tool" && incomingKind !== "tool") {
    target.actionKind = incomingKind;
  }

  const updatedTitle = deriveToolTitle(entry);
  if (
    updatedTitle
    && updatedTitle !== target.title
    && isReplaceableToolTitle(target.title)
  ) {
    target.title = updatedTitle;
  }

  const inputPane = deriveToolInputPane(entry);
  if (inputPane && !target.inputPane) {
    target.inputPane = inputPane;
  }

  const targetPath = extractToolTargetPath(raw, incomingKind, baseTitle);
  if (targetPath && !target.targetPath) {
    target.targetPath = targetPath;
  }

  const outputPane = deriveToolOutputPane(entry);
  if (outputPane) {
    if (
      target.outputPane?.kind === "diff"
      && outputPane.kind !== "diff"
      && target.actionKind === "edit"
      && !isFailedToolStatus(target.status)
    ) {
      return;
    }
    target.outputPane = outputPane;
  }
}

function countToolGroup(tools: AgentToolActivity[]): AgentToolGroupCounts {
  const editedFiles = new Set<string>();
  const readFiles = new Set<string>();
  let searches = 0;
  let commands = 0;
  let agents = 0;
  let genericTools = 0;

  for (const tool of tools) {
    if (tool.actionKind === "edit") {
      // Dedupe by target path when we have one, otherwise count each tool
      // call separately. Previously a missing targetPath silently dropped
      // the edit from the summary entirely.
      editedFiles.add(tool.targetPath || `:${tool.id}`);
      continue;
    }
    if (tool.actionKind === "read") {
      readFiles.add(tool.targetPath || `:${tool.id}`);
      continue;
    }
    if (tool.actionKind === "search") {
      searches += 1;
      continue;
    }
    if (tool.actionKind === "bash") {
      commands += 1;
      continue;
    }
    if (tool.actionKind === "agent") {
      agents += 1;
      continue;
    }
    genericTools += 1;
  }

  return {
    editedFiles: editedFiles.size,
    readFiles: readFiles.size,
    searches,
    commands,
    agents,
    tools: genericTools,
    total: tools.length,
  };
}

function deriveToolGroupStatus(tools: AgentToolActivity[]): string {
  if (tools.some((tool) => ["failed", "error"].includes(tool.status))) {
    return "failed";
  }
  if (tools.some((tool) => ["cancelled", "canceled"].includes(tool.status))) {
    return "cancelled";
  }
  if (tools.some((tool) => RUNNING_TOOL_STATUSES.has(tool.status))) {
    return "in_progress";
  }
  if (tools.every((tool) => ["completed", "done"].includes(tool.status))) {
    return "completed";
  }
  return tools[tools.length - 1]?.status ?? "pending";
}

function createToolGroup(tools: AgentToolActivity[]): AgentActivityItem {
  const firstTool = tools[0];

  return {
    id: `tool-group:${firstTool.id}`,
    kind: "tool_group",
    status: deriveToolGroupStatus(tools),
    timestamp: firstTool.timestamp,
    counts: countToolGroup(tools),
    tools,
  };
}

function groupConsecutiveTools(items: AgentActivityItem[]): AgentActivityItem[] {
  const grouped: AgentActivityItem[] = [];
  let pendingTools: AgentToolActivity[] = [];

  const flushTools = () => {
    if (pendingTools.length === 0) {
      return;
    }
    if (pendingTools.length === 1) {
      grouped.push(pendingTools[0]);
    } else {
      grouped.push(createToolGroup(pendingTools));
    }
    pendingTools = [];
  };

  for (const item of items) {
    if (item.kind === "tool") {
      pendingTools.push(item);
      continue;
    }

    flushTools();
    grouped.push(item);
  }

  flushTools();
  return grouped;
}

function timestampDeltaMs(startTimestamp: string, endTimestamp: string): number | undefined {
  const start = Date.parse(startTimestamp);
  const end = Date.parse(endTimestamp);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return undefined;
  }

  return Math.max(0, end - start);
}

export function formatActivityStatus(status: string): string {
  return status
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

export function buildAgentOutputActivity(snapshot: AgentOutputSnapshot): AgentActivityItem[] {
  const items: AgentActivityItem[] = [];
  const toolIndexById = new Map<string, number>();
  const messageIndexById = new Map<string, number>();
  const permissionDetailByRequestId = new Map<number, string>();
  const permissionIndexByRequestId = new Map<number, number>();
  const thoughtLocationById = new Map<string, { activity: MutableThinkingActivity; index: number }>();
  const outputEntries = coalesceFragmentedMessageEntries(
    Array.isArray(snapshot.outputEntries) ? snapshot.outputEntries : [],
  );
  const seenOutputEntryFingerprints = new Set<string>();
  let openThinking: MutableThinkingActivity | null = null;

  const finishOpenThinking = (endTimestamp: string) => {
    if (!openThinking) {
      return;
    }

    openThinking.inProgress = false;
    openThinking.durationMs = timestampDeltaMs(openThinking.timestamp, endTimestamp);
    openThinking = null;
  };

  for (const entry of outputEntries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const fingerprint = outputEntryFingerprint(entry);
    if (seenOutputEntryFingerprints.has(fingerprint)) {
      continue;
    }
    seenOutputEntryFingerprints.add(fingerprint);

    if (entry.type === "thought") {
      const text = normalizeMultilineText(entry.text || "").trim();
      if (!text) {
        continue;
      }

      const existingThought = thoughtLocationById.get(entry.id);
      if (existingThought) {
        existingThought.activity.thoughts[existingThought.index] = text;
        continue;
      }

      if (openThinking) {
        openThinking.thoughts.push(text);
        thoughtLocationById.set(entry.id, {
          activity: openThinking,
          index: openThinking.thoughts.length - 1,
        });
      } else {
        openThinking = {
          id: entry.id,
          kind: "thinking",
          thoughts: [text],
          timestamp: entry.timestamp,
          inProgress: true,
        };
        items.push(openThinking);
        thoughtLocationById.set(entry.id, { activity: openThinking, index: 0 });
      }
      continue;
    }

    if (entry.type === "message") {
      if (isOmittedOutputEntriesMarker(entry)) {
        continue;
      }
      const text = normalizeMultilineText(entry.text || "").trim();
      if (!text) {
        continue;
      }
      finishOpenThinking(entry.timestamp);
      const existingIndex = messageIndexById.get(entry.id);
      if (existingIndex != null) {
        const existing = items[existingIndex];
        if (existing?.kind === "message") {
          const messageActivity = existing as MutableMessageActivity;
          messageActivity.text = text;
          messageActivity.live = undefined;
          continue;
        }
      }
      messageIndexById.set(entry.id, items.length);
      items.push({
        id: entry.id,
        kind: "message",
        text,
        timestamp: entry.timestamp,
      });
      continue;
    }

    if (entry.type === "permission") {
      const text = normalizeMultilineText(entry.text || "").trim();
      if (!text) {
        continue;
      }
      finishOpenThinking(entry.timestamp);
      const status = normalizeStatus(entry.status);
      const requestId = permissionRequestId(entry);
      const directDetail = permissionToolCallDetail(entry);
      if (requestId !== null && directDetail) {
        permissionDetailByRequestId.set(requestId, directDetail);
      }
      const detail = directDetail ?? (requestId !== null ? permissionDetailByRequestId.get(requestId) ?? null : null);
      const existingIndex = requestId !== null ? permissionIndexByRequestId.get(requestId) : undefined;
      if (existingIndex != null) {
        const existing = items[existingIndex];
        if (existing?.kind === "permission") {
          const permissionActivity = existing as MutablePermissionActivity;
          permissionActivity.title = permissionTitleKeyForStatus(status);
          permissionActivity.text = permissionDisplayText(entry, detail);
          permissionActivity.detail = detail;
          permissionActivity.timestamp = entry.timestamp;
          permissionActivity.status = status;
          continue;
        }
      }
      if (requestId !== null) {
        permissionIndexByRequestId.set(requestId, items.length);
      }
      items.push({
        id: entry.id,
        kind: "permission",
        title: permissionTitleKeyForStatus(status),
        text: permissionDisplayText(entry, detail),
        detail,
        timestamp: entry.timestamp,
        status,
      });
      continue;
    }

    if (entry.type === "tool_call") {
      finishOpenThinking(entry.timestamp);
      const key = entry.toolCallId || entry.id;
      const existingIndex = toolIndexById.get(key);
      if (existingIndex != null) {
        const existing = items[existingIndex];
        if (existing?.kind === "tool") {
          applyToolUpdate(existing, entry);
          continue;
        }
      }

      const toolActivity = createToolActivity(entry);
      toolIndexById.set(key, items.length);
      items.push(toolActivity);
      continue;
    }

    if (entry.type === "tool_call_update") {
      finishOpenThinking(entry.timestamp);
      const key = entry.toolCallId || entry.id;
      const existingIndex = toolIndexById.get(key);
      if (existingIndex != null) {
        const existing = items[existingIndex];
        if (existing?.kind === "tool") {
          applyToolUpdate(existing, entry);
          continue;
        }
      }

      const toolActivity = createToolActivity(entry);
      toolIndexById.set(key, items.length);
      items.push(toolActivity);
    }
  }

  if (openThinking && !shouldKeepTrailingThinkingOpen(snapshot)) {
    const latestEntryTimestamp = outputEntries.at(-1)?.timestamp || openThinking.timestamp;
    finishOpenThinking(latestEntryTimestamp);
  }

  if (items.length === 0) {
    const liveText = cleanPaneText(snapshot.currentText || snapshot.lastText || snapshot.displayText || null);
    if (liveText) {
      items.push({
        id: "live-fallback",
        kind: "message",
        text: liveText,
        timestamp: new Date(0).toISOString(),
        live: true,
      });
    }
  }

  return groupConsecutiveTools(items);
}
