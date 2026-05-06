import type { AgentSnapshot, EventStreamState } from "./types";

type AgentOutputEntry = NonNullable<AgentSnapshot["outputEntries"]>[number];

type OutputEntryType = AgentOutputEntry["type"];

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type CachedLine = {
  text: string;
  firstSeenAt: number;
  lastSeenAt: number;
  hits: number;
};

type CachedEntry = Omit<AgentOutputEntry, "text" | "raw"> & {
  lineHashes: string[];
  firstSeenAt: number;
  lastSeenAt: number;
};

type CachedWorker = {
  updatedAt: number;
  entries: CachedEntry[];
};

type WorkerOutputLineCacheState = {
  version: 1;
  lastCleanupAt: number;
  lines: Record<string, CachedLine>;
  workers: Record<string, CachedWorker>;
};

type WorkerOutputLineCacheOptions = {
  storage?: StorageLike | null;
  now?: () => number;
  storageKey?: string;
  maxWorkers?: number;
  maxLines?: number;
  workerTtlMs?: number;
  cleanupIntervalMs?: number;
};

const DEFAULT_STORAGE_KEY = "omni-worker-output-line-cache:v1";
const DEFAULT_MAX_WORKERS = 80;
const DEFAULT_MAX_LINES = 40_000;
const DEFAULT_WORKER_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const DEFAULT_CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 6;
const LINE_HASH_SEED = 0x9e3779b1;

function browserStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function emptyState(now: number): WorkerOutputLineCacheState {
  return {
    version: 1,
    lastCleanupAt: now,
    lines: {},
    workers: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asOutputEntryType(value: unknown): OutputEntryType {
  const candidate = asString(value);
  return candidate === "message"
    || candidate === "thought"
    || candidate === "tool_call"
    || candidate === "tool_call_update"
    || candidate === "permission"
    ? candidate
    : "message";
}

function parseState(value: string | null, now: number): WorkerOutputLineCacheState {
  if (!value?.trim()) {
    return emptyState(now);
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.lines) || !isRecord(parsed.workers)) {
      return emptyState(now);
    }

    const lines: WorkerOutputLineCacheState["lines"] = {};
    for (const [hash, lineValue] of Object.entries(parsed.lines)) {
      if (!isRecord(lineValue)) {
        continue;
      }

      lines[hash] = {
        text: asString(lineValue.text),
        firstSeenAt: asNumber(lineValue.firstSeenAt, now),
        lastSeenAt: asNumber(lineValue.lastSeenAt, now),
        hits: asNumber(lineValue.hits, 1),
      };
    }

    const workers: WorkerOutputLineCacheState["workers"] = {};
    for (const [workerId, workerValue] of Object.entries(parsed.workers)) {
      if (!isRecord(workerValue) || !Array.isArray(workerValue.entries)) {
        continue;
      }

      workers[workerId] = {
        updatedAt: asNumber(workerValue.updatedAt, now),
        entries: workerValue.entries
          .filter(isRecord)
          .map((entryValue) => ({
            id: asString(entryValue.id),
            type: asOutputEntryType(entryValue.type),
            timestamp: asString(entryValue.timestamp),
            toolCallId: typeof entryValue.toolCallId === "string" ? entryValue.toolCallId : null,
            toolKind: typeof entryValue.toolKind === "string" ? entryValue.toolKind : null,
            status: typeof entryValue.status === "string" ? entryValue.status : null,
            lineHashes: Array.isArray(entryValue.lineHashes)
              ? entryValue.lineHashes.filter((hash): hash is string => typeof hash === "string")
              : [],
            firstSeenAt: asNumber(entryValue.firstSeenAt, now),
            lastSeenAt: asNumber(entryValue.lastSeenAt, now),
          }))
          .filter((entry) => entry.id && entry.timestamp),
      };
    }

    return {
      version: 1,
      lastCleanupAt: asNumber(parsed.lastCleanupAt, now),
      lines,
      workers,
    };
  } catch {
    return emptyState(now);
  }
}

function lineHash(line: string) {
  let hash = LINE_HASH_SEED;
  for (let index = 0; index < line.length; index += 1) {
    hash ^= line.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `l_${(hash >>> 0).toString(36)}`;
}

function textToLines(text: string) {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

function isOmittedOutputEntry(entry: AgentOutputEntry) {
  return entry.id === "output-archive-marker" || entry.id.startsWith("output-entries-omitted:");
}

function outputEntryTimestampMs(entry: AgentOutputEntry | CachedEntry) {
  const value = new Date(entry.timestamp).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortedEntries<T extends AgentOutputEntry | CachedEntry>(entries: Iterable<T>) {
  return Array.from(entries).sort((left, right) => {
    const timeDelta = outputEntryTimestampMs(left) - outputEntryTimestampMs(right);
    return timeDelta !== 0 ? timeDelta : left.id.localeCompare(right.id);
  });
}

function sameCachedEntryContent(left: CachedEntry, right: CachedEntry) {
  return left.id === right.id
    && left.type === right.type
    && left.timestamp === right.timestamp
    && left.toolCallId === right.toolCallId
    && left.toolKind === right.toolKind
    && left.status === right.status
    && left.lineHashes.length === right.lineHashes.length
    && left.lineHashes.every((hash, index) => hash === right.lineHashes[index]);
}

export class WorkerOutputLineCacheManager {
  private readonly storage: StorageLike | null;
  private readonly now: () => number;
  private readonly storageKey: string;
  private readonly maxWorkers: number;
  private readonly maxLines: number;
  private readonly workerTtlMs: number;
  private readonly cleanupIntervalMs: number;
  private state: WorkerOutputLineCacheState;

  constructor(options: WorkerOutputLineCacheOptions = {}) {
    this.storage = options.storage ?? browserStorage();
    this.now = options.now ?? (() => Date.now());
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxWorkers = options.maxWorkers ?? DEFAULT_MAX_WORKERS;
    this.maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
    this.workerTtlMs = options.workerTtlMs ?? DEFAULT_WORKER_TTL_MS;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    const now = this.now();
    this.state = parseState(this.storage?.getItem(this.storageKey) ?? null, now);
    this.cleanupIfNeeded(now);
  }

  hydrateState(state: EventStreamState): EventStreamState {
    let changed = false;
    const agents = (state.agents ?? []).map((agent) => {
      const hydratedAgent = this.hydrateAgent(agent);
      if (hydratedAgent !== agent) {
        changed = true;
      }
      return hydratedAgent;
    });

    return changed ? { ...state, agents } : state;
  }

  rememberState(state: EventStreamState) {
    let changed = false;
    const now = this.now();

    for (const agent of state.agents ?? []) {
      if (this.rememberAgent(agent, now)) {
        changed = true;
      }
    }

    if (this.cleanupIfNeeded(now)) {
      changed = true;
    }

    if (changed) {
      this.persist();
    }
  }

  private hydrateAgent(agent: AgentSnapshot): AgentSnapshot {
    const worker = this.state.workers[agent.name];
    if (!worker?.entries.length) {
      return agent;
    }

    const entriesById = new Map<string, AgentOutputEntry>();
    for (const cachedEntry of worker.entries) {
      const text = cachedEntry.lineHashes
        .map((hash) => this.state.lines[hash]?.text)
        .filter((line): line is string => line !== undefined)
        .join("\n");
      if (!text && cachedEntry.lineHashes.length > 0) {
        continue;
      }

      entriesById.set(cachedEntry.id, {
        id: cachedEntry.id,
        type: cachedEntry.type,
        text,
        timestamp: cachedEntry.timestamp,
        toolCallId: cachedEntry.toolCallId,
        toolKind: cachedEntry.toolKind,
        status: cachedEntry.status,
      });
    }

    for (const entry of agent.outputEntries ?? []) {
      entriesById.set(entry.id, entry);
    }

    if (entriesById.size === 0) {
      return agent;
    }

    const outputEntries = sortedEntries(entriesById.values());
    if (
      agent.outputEntries
      && outputEntries.length === agent.outputEntries.length
      && outputEntries.every((entry, index) => entry === agent.outputEntries?.[index])
    ) {
      return agent;
    }

    return {
      ...agent,
      outputEntries,
    };
  }

  private rememberAgent(agent: AgentSnapshot, now: number) {
    const outputEntries = (agent.outputEntries ?? []).filter((entry) => !isOmittedOutputEntry(entry));
    if (outputEntries.length === 0) {
      return false;
    }

    const existingWorker = this.state.workers[agent.name];
    const entriesById = new Map(existingWorker?.entries.map((entry) => [entry.id, entry]));
    let changed = false;

    for (const entry of outputEntries) {
      const lineHashes = textToLines(entry.text).map((line) => {
        const hash = lineHash(line);
        const existingLine = this.state.lines[hash];
        if (!existingLine) {
          this.state.lines[hash] = {
            text: line,
            firstSeenAt: now,
            lastSeenAt: now,
            hits: 1,
          };
          changed = true;
        }
        return hash;
      });

      const existingEntry = entriesById.get(entry.id);
      const candidateEntry: CachedEntry = {
        id: entry.id,
        type: entry.type,
        timestamp: entry.timestamp,
        toolCallId: entry.toolCallId ?? null,
        toolKind: entry.toolKind ?? null,
        status: entry.status ?? null,
        lineHashes,
        firstSeenAt: existingEntry?.firstSeenAt ?? now,
        lastSeenAt: existingEntry?.lastSeenAt ?? now,
      };

      if (!existingEntry || !sameCachedEntryContent(existingEntry, candidateEntry)) {
        entriesById.set(entry.id, {
          ...candidateEntry,
          lastSeenAt: now,
        });
        changed = true;
      }
    }

    const entries = sortedEntries(entriesById.values());
    if (changed || !existingWorker) {
      this.state.workers[agent.name] = {
        updatedAt: now,
        entries,
      };
    }

    return changed || !existingWorker;
  }

  private cleanupIfNeeded(now: number) {
    if (now - this.state.lastCleanupAt < this.cleanupIntervalMs) {
      return false;
    }

    this.state.lastCleanupAt = now;
    const workers = Object.entries(this.state.workers)
      .filter(([, worker]) => now - worker.updatedAt <= this.workerTtlMs)
      .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
      .slice(0, this.maxWorkers);
    this.state.workers = Object.fromEntries(workers);

    const referencedLineHashes = new Set<string>();
    for (const worker of Object.values(this.state.workers)) {
      for (const entry of worker.entries) {
        for (const hash of entry.lineHashes) {
          referencedLineHashes.add(hash);
        }
      }
    }

    const retainedLines = Object.entries(this.state.lines)
      .filter(([hash]) => referencedLineHashes.has(hash))
      .sort(([, left], [, right]) => right.lastSeenAt - left.lastSeenAt)
      .slice(0, this.maxLines);
    this.state.lines = Object.fromEntries(retainedLines);
    return true;
  }

  private persist() {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore storage failures; the live stream can still render in memory.
      }
    }
  }
}
