import type { AgentOutputEntry } from "@/lib/agent-output";

export type WorkerTerminalProcessStatus =
  | "pending"
  | "in_progress"
  | "running"
  | "working"
  | "completed"
  | "failed"
  | "error"
  | "cancelled"
  | "unknown";

export type WorkerTerminalProcess = {
  id: string;
  command: string;
  status: WorkerTerminalProcessStatus;
  startedAt: string;
  updatedAt: string;
  outputTail: string | null;
  toolKind: string | null;
  active: boolean;
};

type MutableWorkerTerminalProcess = Omit<WorkerTerminalProcess, "active">;

const ACTIVE_PROCESS_STATUSES = new Set<WorkerTerminalProcessStatus>([
  "pending",
  "in_progress",
  "running",
  "working",
]);
const TERMINAL_KIND_PATTERN = /\b(execute|terminal|shell|bash|command|run)\b/i;
const OUTPUT_TAIL_LIMIT = 640;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeMultilineText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function normalizeStatus(value: string | null | undefined): WorkerTerminalProcessStatus {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "pending":
    case "in_progress":
    case "running":
    case "working":
    case "completed":
    case "failed":
    case "error":
    case "cancelled":
      return normalized;
    case "done":
    case "success":
      return "completed";
    case undefined:
    case "":
      return "unknown";
    default:
      return "unknown";
  }
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

      return asNonEmptyString(record.text);
    })
    .filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join("\n\n") : null;
}

function extractCommand(raw: Record<string, unknown> | null): string | null {
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
    const command = asNonEmptyString(candidate);
    if (command) {
      return normalizeMultilineText(command);
    }
  }

  return null;
}

function extractOutputText(raw: Record<string, unknown> | null): string | null {
  if (!raw) {
    return null;
  }

  const meta = asRecord(raw._meta);
  const claudeCode = asRecord(meta?.claudeCode);
  const toolResponse = asRecord(claudeCode?.toolResponse);
  const rawOutput = asRecord(raw.rawOutput);
  const candidates = [
    toolResponse?.stderr,
    toolResponse?.stdout,
    rawOutput?.formatted_output,
    rawOutput?.stderr,
    rawOutput?.stdout,
    raw.output,
    raw.stderr,
    raw.stdout,
    extractContentText(raw.content),
    stringifyUnknown(raw.rawOutput),
  ];

  for (const candidate of candidates) {
    const text = asNonEmptyString(candidate);
    if (text) {
      return normalizeMultilineText(text);
    }
  }

  return null;
}

function trimOutputTail(value: string): string {
  const normalized = normalizeMultilineText(value);
  if (normalized.length <= OUTPUT_TAIL_LIMIT) {
    return normalized;
  }

  return normalized.slice(normalized.length - OUTPUT_TAIL_LIMIT).replace(/^[^\n]*\n?/, "").trim();
}

function isTerminalLike(entry: AgentOutputEntry, command: string | null): boolean {
  if (command) {
    return true;
  }

  const raw = asRecord(entry.raw);
  const kind = entry.toolKind || asNonEmptyString(raw?.kind);
  const title = asNonEmptyString(raw?.title);
  return TERMINAL_KIND_PATTERN.test(`${kind ?? ""} ${title ?? ""} ${entry.text ?? ""}`);
}

function toProcess(entry: AgentOutputEntry, allowSparseUpdate = false): MutableWorkerTerminalProcess | null {
  if (entry.type !== "tool_call" && entry.type !== "tool_call_update") {
    return null;
  }

  const raw = asRecord(entry.raw);
  const command = extractCommand(raw);
  if (!allowSparseUpdate && !isTerminalLike(entry, command)) {
    return null;
  }

  const fallbackCommand = asNonEmptyString(raw?.title) || asNonEmptyString(entry.text) || "Terminal process";
  const output = extractOutputText(raw);

  return {
    id: entry.toolCallId || entry.id,
    command: command || fallbackCommand,
    status: normalizeStatus(entry.status),
    startedAt: entry.timestamp,
    updatedAt: entry.timestamp,
    outputTail: output ? trimOutputTail(output) : null,
    toolKind: entry.toolKind || asNonEmptyString(raw?.kind),
  };
}

function mergeProcess(target: MutableWorkerTerminalProcess, next: MutableWorkerTerminalProcess): void {
  if (Date.parse(next.startedAt) < Date.parse(target.startedAt)) {
    target.startedAt = next.startedAt;
  }

  if (Date.parse(next.updatedAt) >= Date.parse(target.updatedAt)) {
    target.updatedAt = next.updatedAt;
  }

  if (next.command !== "Terminal process" && target.command === "Terminal process") {
    target.command = next.command;
  }

  if (next.status !== "unknown") {
    target.status = next.status;
  }

  if (next.outputTail) {
    target.outputTail = next.outputTail;
  }

  if (next.toolKind) {
    target.toolKind = next.toolKind;
  }
}

export function isActiveWorkerTerminalProcess(process: Pick<WorkerTerminalProcess, "status">): boolean {
  return ACTIVE_PROCESS_STATUSES.has(process.status);
}

export function deriveWorkerTerminalProcesses(outputEntries: AgentOutputEntry[] | null | undefined): WorkerTerminalProcess[] {
  const entries = Array.isArray(outputEntries) ? outputEntries : [];
  const processesById = new Map<string, MutableWorkerTerminalProcess>();

  for (const entry of entries) {
    const processId = entry.toolCallId || entry.id;
    const nextProcess = toProcess(entry, processesById.has(processId));
    if (!nextProcess) {
      continue;
    }

    const existingProcess = processesById.get(nextProcess.id);
    if (existingProcess) {
      mergeProcess(existingProcess, nextProcess);
    } else {
      processesById.set(nextProcess.id, nextProcess);
    }
  }

  return Array.from(processesById.values())
    .map((process) => ({
      ...process,
      active: isActiveWorkerTerminalProcess(process),
    }))
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });
}
