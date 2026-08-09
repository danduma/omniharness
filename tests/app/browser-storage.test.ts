import { describe, expect, it, vi } from "vitest";
import { EventStreamSnapshotCacheManager } from "@/interface/home/EventStreamSnapshotCacheManager";
import { WorkerEntriesManager } from "@/interface/home/WorkerEntriesManager";
import type { EventStreamState } from "@/interface/home/types";
import type { WorkerEntry } from "@/server/workers/entries-types";
import {
  PREVIEW_CACHE_STORAGE_KEYS,
  safeSetBrowserStorageItem,
} from "@/lib/browser-storage";

function createMemoryStorage() {
  const values = new Map<string, string>();
  const writes: Array<{ key: string; value: string }> = [];
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes.push({ key, value });
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  return { storage, values, writes };
}

function createState(): EventStreamState {
  return {
    runs: [],
    messages: [],
    plans: [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
    queuedMessages: [],
    recoveryIncidents: [],
    frontendErrors: [],
  };
}

function createWorkerEntry(): WorkerEntry {
  return {
    id: "entry-1",
    seq: 1,
    type: "message",
    text: "hello",
    timestamp: "2026-01-01T00:00:00.000Z",
  } as WorkerEntry;
}

describe("browser storage policy", () => {
  it("does not persist event snapshots or worker transcript bodies by default", () => {
    const { storage, writes } = createMemoryStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      addEventListener: vi.fn(),
    });

    const snapshotCache = new EventStreamSnapshotCacheManager({ flushIntervalMs: 0 });
    snapshotCache.rememberState(createState(), "run-1");
    snapshotCache.flush();

    const workerCache = new WorkerEntriesManager({ flushIntervalMs: 0 });
    workerCache.getState("worker-1", [createWorkerEntry()]);
    workerCache.flushCache();

    expect(writes).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("evicts only disposable preview caches before retrying a quota-blocked write", () => {
    const { storage, values } = createMemoryStorage();
    for (const key of PREVIEW_CACHE_STORAGE_KEYS) {
      values.set(key, "stale preview");
    }

    let firstAttempt = true;
    const quotaStorage = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (firstAttempt) {
          firstAttempt = false;
          throw new DOMException("storage full", "QuotaExceededError");
        }
        storage.setItem(key, value);
      },
    };

    expect(safeSetBrowserStorageItem(quotaStorage, "omni-composer-effort:codex:model", "High")).toBe(true);
    expect(values.get("omni-composer-effort:codex:model")).toBe("High");
    for (const key of PREVIEW_CACHE_STORAGE_KEYS) {
      expect(values.has(key)).toBe(false);
    }
  });

  it("does not throw when storage remains unavailable after preview cleanup", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("storage full", "QuotaExceededError");
      },
      removeItem: vi.fn(),
    };

    expect(() => safeSetBrowserStorageItem(storage, "omni-collapsed-projects", "[]")).not.toThrow();
    expect(safeSetBrowserStorageItem(storage, "omni-collapsed-projects", "[]")).toBe(false);
  });
});
