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
  label: "IN" | "OUT";
  text: string;
}

const TERMINAL_TOOL_STATUSES = new Set(["completed", "failed", "cancelled", "done", "error"]);

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
  | {
      id: string;
      kind: "tool";
      label: string;
      title: string;
      status: string;
      timestamp: string;
      inputPane?: AgentOutputPane;
      outputPane?: AgentOutputPane;
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
  currentText?: string | null;
  lastText?: string | null;
};

type MutableToolActivity = Extract<AgentActivityItem, { kind: "tool" }>;
type MutableThinkingActivity = Extract<AgentActivityItem, { kind: "thinking" }>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n?/g, "\n");
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

function normalizeToolKind(toolKind: string | null | undefined, title: string): "read" | "bash" | "agent" | "edit" | "search" | "tool" {
  const haystack = `${toolKind ?? ""} ${title}`.toLowerCase();
  if (/\b(read|open|view)\b/.test(haystack)) {
    return "read";
  }
  if (/\b(execute|terminal|shell|bash|command|run)\b/.test(haystack)) {
    return "bash";
  }
  if (/\b(agent|delegate|dispatch|spawn|worker)\b/.test(haystack)) {
    return "agent";
  }
  if (/\b(edit|write|replace|patch|create)\b/.test(haystack)) {
    return "edit";
  }
  if (/\b(search|find|grep|glob)\b/.test(haystack)) {
    return "search";
  }
  return "tool";
}

function toolLabel(kind: ReturnType<typeof normalizeToolKind>): string {
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
  const meta = asRecord(raw?._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const file = asRecord(toolResponse?.file);
  const stdout = asNonEmptyString(toolResponse?.stdout);
  const stderr = asNonEmptyString(toolResponse?.stderr);
  const rawOutput = raw ? raw.rawOutput : undefined;
  const contentText = extractContentText(raw?.content);
  const rawOutputText = stringifyUnknown(rawOutput);
  const metaOutputText = stringifyUnknown(file?.content) || stdout || stderr;
  const summaryTail = extractSummaryTail(entry);
  const isTerminal = entry.status ? TERMINAL_TOOL_STATUSES.has(entry.status) : false;

  if (!isTerminal && !metaOutputText && !rawOutputText) {
    return undefined;
  }

  const text = cleanPaneText(metaOutputText || contentText || rawOutputText || summaryTail);

  return text ? { label: "OUT", text } : undefined;
}

function normalizeStatus(value: string | null | undefined, fallback = "pending"): string {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : fallback;
}

function createToolActivity(entry: AgentOutputEntry): MutableToolActivity {
  const raw = asRecord(entry.raw);
  const baseTitle = asNonEmptyString(raw?.title) || entry.text || "Tool activity";
  const kind = normalizeToolKind(entry.toolKind ?? asNonEmptyString(raw?.kind), baseTitle);

  return {
    id: entry.toolCallId || entry.id,
    kind: "tool",
    label: toolLabel(kind),
    title: deriveToolTitle(entry),
    status: normalizeStatus(entry.status),
    timestamp: entry.timestamp,
    inputPane: deriveToolInputPane(entry),
    outputPane: deriveToolOutputPane(entry),
  };
}

function applyToolUpdate(target: MutableToolActivity, entry: AgentOutputEntry): void {
  target.status = normalizeStatus(entry.status, target.status);
  const updatedTitle = deriveToolTitle(entry);
  if (
    updatedTitle
    && updatedTitle !== target.title
    && ["Tool activity", "Terminal", "Read File", "Execute", "Bash"].includes(target.title)
  ) {
    target.title = updatedTitle;
  }

  const inputPane = deriveToolInputPane(entry);
  if (inputPane && !target.inputPane) {
    target.inputPane = inputPane;
  }

  const outputPane = deriveToolOutputPane(entry);
  if (outputPane) {
    target.outputPane = outputPane;
  }
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
      items.push({
        id: entry.id,
        kind: "permission",
        title: "Permission requested",
        text,
        timestamp: entry.timestamp,
        status: normalizeStatus(entry.status),
      });
      continue;
    }

    if (entry.type === "tool_call") {
      finishOpenThinking(entry.timestamp);
      const toolActivity = createToolActivity(entry);
      toolIndexById.set(entry.toolCallId || entry.id, items.length);
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

  if (items.length === 0) {
    const liveText = cleanPaneText(snapshot.currentText || snapshot.lastText || null);
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

  return items;
}
