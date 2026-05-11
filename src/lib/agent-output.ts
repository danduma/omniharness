export interface AgentOutputEntry {
  id: string;
  type: "message" | "thought" | "tool_call" | "tool_call_update" | "permission";
  text: string;
  timestamp: string;
  toolCallId?: string | null;
  toolKind?: string | null;
  status?: string | null;
  raw?: unknown;
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
      timestamp: string;
      status: string;
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
      return diff ? [`${pathPrefixForDiff(path, diff)}${diff}`] : [];
    });
}

function buildReplacementDiff(rawInput: Record<string, unknown> | null): string | null {
  if (!rawInput) {
    return null;
  }

  const oldString = typeof rawInput.old_string === "string" ? normalizeMultilineText(rawInput.old_string) : null;
  const newString = typeof rawInput.new_string === "string" ? normalizeMultilineText(rawInput.new_string) : null;
  if (oldString == null || newString == null || oldString === newString) {
    return null;
  }

  const path = extractPrimaryPath({ rawInput });
  const removed = oldString.split("\n").map((line) => `-${line}`).join("\n");
  const added = newString.split("\n").map((line) => `+${line}`).join("\n");
  return `${pathPrefixForDiff(path, "")}@@ replacement @@\n${removed}\n${added}`;
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

  return diffs.length > 0 ? diffs.join("\n\n") : null;
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

  if (kind === "bash" || kind === "agent") {
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
      if (tool.targetPath) {
        editedFiles.add(tool.targetPath);
      }
      continue;
    }
    if (tool.actionKind === "read") {
      if (tool.targetPath) {
        readFiles.add(tool.targetPath);
      }
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
  const lastTool = tools[tools.length - 1];

  return {
    id: `tool-group:${firstTool.id}:${lastTool.id}`,
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
  const outputEntries = Array.isArray(snapshot.outputEntries) ? snapshot.outputEntries : [];
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

    if (entry.type === "thought") {
      const text = normalizeMultilineText(entry.text || "").trim();
      if (!text) {
        continue;
      }

      if (openThinking) {
        openThinking.thoughts.push(text);
      } else {
        openThinking = {
          id: entry.id,
          kind: "thinking",
          thoughts: [text],
          timestamp: entry.timestamp,
          inProgress: true,
        };
        items.push(openThinking);
      }
      continue;
    }

    if (entry.type === "message") {
      const text = normalizeMultilineText(entry.text || "").trim();
      if (!text) {
        continue;
      }
      finishOpenThinking(entry.timestamp);
      if (isOmittedOutputEntriesMarker(entry)) {
        continue;
      }
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
      items.push({
        id: entry.id,
        kind: "permission",
        title: permissionTitleKeyForStatus(status),
        text,
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
