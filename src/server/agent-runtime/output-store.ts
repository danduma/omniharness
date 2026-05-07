import { randomUUID } from "crypto";
import { appendFileSync, closeSync, createReadStream, existsSync, mkdirSync, openSync, readSync, rmSync, statSync } from "fs";
import { dirname, join } from "path";
import { createInterface } from "readline";
import type { AgentRecord, OutputArchivePage, OutputArchiveStats, OutputEntry } from "./types";

const LIVE_TEXT_FIELD_CHARS = 100_000;
const LIVE_OUTPUT_ENTRY_LIMIT = 80;
const LIVE_OUTPUT_ENTRY_TEXT_CHARS = 5_000;
const LIVE_RAW_STRING_CHARS = 4_000;
const ARCHIVE_ENTRY_TEXT_CHARS = 1_000_000;
const ARCHIVE_RAW_STRING_CHARS = 1_000_000;
const RAW_ARRAY_ITEMS = 200;
const RAW_OBJECT_KEYS = 100;
const RAW_DEPTH = 8;
const OUTPUT_TRUNCATION_MARKER = "[Earlier runtime output omitted]\n";
const ARCHIVE_MARKER_ID = "output-archive-marker";
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGE_LIMIT = 500;

type OutputEntryInput = Omit<OutputEntry, "id" | "timestamp"> & { timestamp?: string };

function nowIso() {
  return new Date().toISOString();
}

function sanitizePathPart(input: string) {
  const sanitized = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "agent";
}

export function truncateString(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxChars - 37))}\n[truncated ${value.length - maxChars} chars]`;
}

export function appendBoundedText(existing: string, chunk: string, maxChars = LIVE_TEXT_FIELD_CHARS) {
  if (chunk.length === 0) {
    return existing;
  }
  const next = existing + chunk;
  if (next.length <= maxChars) {
    return next;
  }
  const tailLength = Math.max(0, maxChars - OUTPUT_TRUNCATION_MARKER.length);
  return OUTPUT_TRUNCATION_MARKER + next.slice(-tailLength);
}

function compactRawValue(
  value: unknown,
  maxStringChars: number,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") {
    return truncateString(value, maxStringChars);
  }
  if (value == null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  if (depth >= RAW_DEPTH) {
    return "[truncated depth]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const compacted = value.slice(0, RAW_ARRAY_ITEMS).map((item) => compactRawValue(item, maxStringChars, depth + 1, seen));
    if (value.length > RAW_ARRAY_ITEMS) {
      compacted.push(`[truncated ${value.length - RAW_ARRAY_ITEMS} items]`);
    }
    return compacted;
  }

  const compacted: Record<string, unknown> = {};
  const entries = Object.entries(value);
  for (const [key, nestedValue] of entries.slice(0, RAW_OBJECT_KEYS)) {
    compacted[key] = compactRawValue(nestedValue, maxStringChars, depth + 1, seen);
  }
  if (entries.length > RAW_OBJECT_KEYS) {
    compacted.__truncatedKeys = entries.length - RAW_OBJECT_KEYS;
  }
  return compacted;
}

function createArchiveEntry(input: OutputEntryInput): OutputEntry {
  return {
    id: randomUUID(),
    timestamp: input.timestamp ?? nowIso(),
    type: input.type,
    text: truncateString(input.text, ARCHIVE_ENTRY_TEXT_CHARS),
    toolCallId: input.toolCallId,
    toolKind: input.toolKind,
    status: input.status,
    raw: compactRawValue(input.raw, ARCHIVE_RAW_STRING_CHARS),
  };
}

function toLiveEntry(entry: OutputEntry): OutputEntry {
  return {
    ...entry,
    text: truncateString(entry.text, LIVE_OUTPUT_ENTRY_TEXT_CHARS),
    raw: compactRawValue(entry.raw, LIVE_RAW_STRING_CHARS),
  };
}

function lineByteLength(line: string) {
  return Buffer.byteLength(line) + 1;
}

function parseOutputLine(line: string): OutputEntry | null {
  try {
    const parsed = JSON.parse(line) as OutputEntry;
    if (typeof parsed.id === "string" && typeof parsed.type === "string" && typeof parsed.text === "string") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export class AgentOutputArchive {
  private totalEntries = 0;
  private byteSize = 0;

  constructor(
    readonly name: string,
    readonly filePath: string,
    input: { truncate?: boolean } = {},
  ) {
    mkdirSync(dirname(filePath), { recursive: true });
    if (input.truncate) {
      rmSync(filePath, { force: true });
    }
    if (existsSync(filePath)) {
      this.rebuildStats();
    }
  }

  append(input: OutputEntryInput): OutputEntry {
    const entry = createArchiveEntry(input);
    const line = JSON.stringify(entry);
    appendFileSync(this.filePath, `${line}\n`, "utf8");
    this.totalEntries += 1;
    this.byteSize += lineByteLength(line);
    return entry;
  }

  stats(liveEntries = 0): OutputArchiveStats {
    return {
      totalEntries: this.totalEntries,
      byteSize: this.byteSize,
      logPath: this.filePath,
      liveEntries,
      omittedLiveEntries: Math.max(0, this.totalEntries - liveEntries),
    };
  }

  async readPage(input: { cursor?: number; limit?: number } = {}): Promise<OutputArchivePage> {
    const cursor = Math.max(0, Math.floor(input.cursor ?? 0));
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(input.limit ?? DEFAULT_PAGE_LIMIT)));
    if (!existsSync(this.filePath) || cursor >= this.byteSize) {
      return {
        name: this.name,
        cursor,
        nextCursor: null,
        totalEntries: this.totalEntries,
        entries: [],
      };
    }

    const entries: OutputEntry[] = [];
    let nextCursor = cursor;
    const stream = createReadStream(this.filePath, { encoding: "utf8", start: cursor });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of lines) {
      nextCursor += lineByteLength(line);
      const entry = parseOutputLine(line);
      if (entry) {
        entries.push(entry);
      }
      if (entries.length >= limit) {
        break;
      }
    }
    lines.close();
    stream.destroy();

    return {
      name: this.name,
      cursor,
      nextCursor: nextCursor < this.byteSize ? nextCursor : null,
      totalEntries: this.totalEntries,
      entries,
    };
  }

  private rebuildStats() {
    const contents = statSync(this.filePath);
    this.byteSize = contents.size;
    this.totalEntries = 0;
    if (contents.size === 0) {
      return;
    }
    const fd = openSync(this.filePath, "r");
    try {
      const buffer = Buffer.allocUnsafe(64 * 1024);
      let bytesRead = 0;
      do {
        bytesRead = readSync(fd, buffer, 0, buffer.length, null);
        for (let index = 0; index < bytesRead; index += 1) {
          if (buffer[index] === 10) {
            this.totalEntries += 1;
          }
        }
      } while (bytesRead > 0);
    } finally {
      closeSync(fd);
    }
  }
}

export function openAgentOutputArchive(input: { dataDir?: string | null; name: string; resume?: boolean }) {
  const dataDir = input.dataDir?.trim() || join(process.cwd(), ".omniharness");
  return new AgentOutputArchive(
    input.name,
    join(dataDir, "agent-runtime-output", `${sanitizePathPart(input.name)}.jsonl`),
    { truncate: !input.resume },
  );
}

function pruneLiveEntries(record: AgentRecord) {
  const totalEntries = record.outputArchive.stats().totalEntries;
  const liveLimit = totalEntries > LIVE_OUTPUT_ENTRY_LIMIT ? LIVE_OUTPUT_ENTRY_LIMIT - 1 : LIVE_OUTPUT_ENTRY_LIMIT;
  if (record.outputEntries.length <= liveLimit) {
    return;
  }
  record.outputEntries.splice(0, record.outputEntries.length - liveLimit);
  if (record.activeOutputEntryId && !record.outputEntries.some((entry) => entry.id === record.activeOutputEntryId)) {
    record.activeOutputEntryId = null;
  }
}

export function appendOutputEntry(record: AgentRecord, input: OutputEntryInput) {
  const archiveEntry = record.outputArchive.append(input);
  record.activeOutputEntryId = null;
  record.outputEntries.push(toLiveEntry(archiveEntry));
  pruneLiveEntries(record);
}

export function appendMessageChunk(record: AgentRecord, text: string, type: "message" | "thought") {
  const archiveEntry = record.outputArchive.append({ type, text });
  const activeEntry = record.activeOutputEntryId
    ? record.outputEntries.find((entry) => entry.id === record.activeOutputEntryId)
    : null;

  if (activeEntry && activeEntry.type === type) {
    activeEntry.text = appendBoundedText(activeEntry.text, text, LIVE_OUTPUT_ENTRY_TEXT_CHARS);
    return;
  }

  const liveEntry = toLiveEntry(archiveEntry);
  record.outputEntries.push(liveEntry);
  record.activeOutputEntryId = liveEntry.id;
  pruneLiveEntries(record);
}

export function selectLiveOutputEntries(record: AgentRecord) {
  const stats = record.outputArchive.stats(record.outputEntries.length);
  if (stats.omittedLiveEntries <= 0) {
    return record.outputEntries.map((entry) => ({ ...entry }));
  }

  const first = record.outputEntries[0];
  const marker: OutputEntry = {
    id: ARCHIVE_MARKER_ID,
    type: "message",
    text: `${stats.omittedLiveEntries} older raw worker activity records are only in archived history, not in the current terminal output.`,
    timestamp: first?.timestamp ?? new Date(0).toISOString(),
    status: "archived",
  };
  return [marker, ...record.outputEntries.map((entry) => ({ ...entry }))];
}

export function summarizeToolCallUpdate(update: Record<string, unknown>) {
  const contentSummary = Array.isArray(update.content)
    ? update.content
        .map((item) => {
          const record = typeof item === "object" && item !== null && !Array.isArray(item) ? item as Record<string, unknown> : null;
          const content = typeof record?.content === "object" && record.content !== null && !Array.isArray(record.content)
            ? record.content as Record<string, unknown>
            : null;
          if (record?.type === "content" && content?.type === "text" && typeof content.text === "string") {
            return content.text;
          }
          if (record?.type === "content" && content?.type) {
            return `[${content.type}]`;
          }
          return "";
        })
        .filter(Boolean)
        .join(" ")
    : "";

  const toolCallId = typeof update.toolCallId === "string" ? update.toolCallId : "";
  const status = typeof update.status === "string" ? update.status : "updated";
  const base = `Tool call ${toolCallId} ${status}`.trim();
  return contentSummary ? `${base}: ${contentSummary}` : base;
}

export function renderOutputEntries(entries: OutputEntry[]) {
  return truncateString(entries
    .map((entry) => {
      switch (entry.type) {
        case "message":
          return entry.text;
        case "thought":
          return `Thought: ${entry.text}`;
        case "tool_call":
          return `Tool${entry.toolKind ? ` ${entry.toolKind}` : ""}${entry.status ? ` (${entry.status})` : ""}: ${entry.text}`;
        case "tool_call_update":
          return `${entry.status ? `Tool update (${entry.status})` : "Tool update"}: ${entry.text}`;
        case "permission":
          return `Permission: ${entry.text}`;
        default:
          return entry.text;
      }
    })
    .filter(Boolean)
    .join("\n\n"), LIVE_TEXT_FIELD_CHARS);
}
