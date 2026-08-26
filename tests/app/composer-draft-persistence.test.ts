import { describe, expect, it } from "vitest";
import type { BrowserStorage } from "@/lib/browser-storage";
import {
  COMPOSER_DRAFTS_STORAGE_KEY,
  ComposerDraftPersistence,
  collectComposerDrafts,
  parsePersistedComposerDrafts,
  serializeComposerDrafts,
} from "@/interface/home/ComposerDraftPersistence";
import { HomeUiStateManager, NEW_CONVERSATION_DRAFT_KEY } from "@/interface/home/HomeUiStateManager";

const NOW = 1_800_000_000_000;

function memoryStorage(seed: Record<string, string> = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    entries,
    storage: {
      getItem: (key: string) => entries.get(key) ?? null,
      setItem: (key: string, value: string) => {
        entries.set(key, value);
      },
      removeItem: (key: string) => {
        entries.delete(key);
      },
    } satisfies BrowserStorage,
  };
}

function persistenceFor(storage: BrowserStorage) {
  return new ComposerDraftPersistence({ storage, now: () => NOW, debounceMs: 0 });
}

/** Stands in for `window`/`document`, which the node test environment lacks. */
function flushTarget(visibilityState = "visible") {
  const listeners = new Map<string, Set<() => void>>();
  return {
    visibilityState,
    addEventListener(type: string, listener: () => void) {
      const existing = listeners.get(type) ?? new Set<() => void>();
      existing.add(listener);
      listeners.set(type, existing);
    },
    removeEventListener(type: string, listener: () => void) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type: string) {
      listeners.get(type)?.forEach((listener) => listener());
    },
    listenerCount() {
      return Array.from(listeners.values()).reduce((total, set) => total + set.size, 0);
    },
  };
}

function readDrafts(entries: Map<string, string>) {
  return parsePersistedComposerDrafts(entries.get(COMPOSER_DRAFTS_STORAGE_KEY) ?? null, NOW);
}

describe("collectComposerDrafts", () => {
  it("captures the live composer alongside drafts parked on other runs", () => {
    const drafts = collectComposerDrafts({
      command: "half-typed prompt",
      commandCursor: 4,
      selectedRunId: null,
      composerDraftsByRun: {
        "run-a": { command: "parked", commandCursor: 6, mentionIndex: 0, attachments: [] },
      },
    }, NOW);

    expect(drafts).toEqual({
      "run-a": { command: "parked", commandCursor: 6, updatedAt: NOW },
      [NEW_CONVERSATION_DRAFT_KEY]: { command: "half-typed prompt", commandCursor: 4, updatedAt: NOW },
    });
  });

  it("omits empty composers so a sent message clears its draft", () => {
    const drafts = collectComposerDrafts({
      command: "",
      commandCursor: 0,
      selectedRunId: "run-a",
      composerDraftsByRun: {},
    }, NOW);

    expect(drafts).toEqual({});
  });

  it("keeps the original timestamp when a draft is unchanged", () => {
    const previous = { "run-a": { command: "parked", commandCursor: 6, updatedAt: NOW - 5_000 } };
    const drafts = collectComposerDrafts({
      command: "",
      commandCursor: 0,
      selectedRunId: null,
      composerDraftsByRun: {
        "run-a": { command: "parked", commandCursor: 6, mentionIndex: 0, attachments: [] },
      },
    }, NOW, previous);

    expect(drafts["run-a"].updatedAt).toBe(NOW - 5_000);
  });
});

describe("parsePersistedComposerDrafts", () => {
  it("returns nothing for malformed or foreign-version payloads", () => {
    expect(parsePersistedComposerDrafts(null, NOW)).toEqual({});
    expect(parsePersistedComposerDrafts("{not json", NOW)).toEqual({});
    expect(parsePersistedComposerDrafts(JSON.stringify({ version: 2, drafts: {} }), NOW)).toEqual({});
  });

  it("drops expired drafts and clamps cursors into the restored text", () => {
    const raw = JSON.stringify({
      version: 1,
      drafts: {
        stale: { command: "old", commandCursor: 3, updatedAt: NOW - 40 * 24 * 60 * 60 * 1000 },
        fresh: { command: "kept", commandCursor: 9999, updatedAt: NOW - 1_000 },
      },
    });

    expect(parsePersistedComposerDrafts(raw, NOW)).toEqual({
      fresh: { command: "kept", commandCursor: 4, updatedAt: NOW - 1_000 },
    });
  });
});

describe("serializeComposerDrafts", () => {
  it("evicts the stalest drafts first and never the active composer", () => {
    const active = "a".repeat(200_000);
    const serialized = serializeComposerDrafts({
      [NEW_CONVERSATION_DRAFT_KEY]: { command: active, commandCursor: 0, updatedAt: NOW - 60_000 },
      "run-old": { command: "b".repeat(100_000), commandCursor: 0, updatedAt: NOW - 10_000 },
      "run-new": { command: "c".repeat(100_000), commandCursor: 0, updatedAt: NOW },
    }, NEW_CONVERSATION_DRAFT_KEY);

    const parsed = parsePersistedComposerDrafts(serialized, NOW);
    expect(parsed[NEW_CONVERSATION_DRAFT_KEY]?.command).toBe(active);
    expect(parsed["run-old"]).toBeUndefined();
  });
});

describe("ComposerDraftPersistence", () => {
  it("persists a new-conversation draft and restores it into a fresh manager", () => {
    const { entries, storage } = memoryStorage();
    const manager = new HomeUiStateManager();
    const detach = persistenceFor(storage).attach(manager);

    manager.setComposerDraft({ command: "a very long prompt", commandCursor: 18 });
    detach();

    expect(readDrafts(entries)[NEW_CONVERSATION_DRAFT_KEY]).toEqual({
      command: "a very long prompt",
      commandCursor: 18,
      updatedAt: NOW,
    });

    const restored = new HomeUiStateManager();
    persistenceFor(storage).hydrate(restored);
    expect(restored.getSnapshot().command).toBe("a very long prompt");
    expect(restored.getSnapshot().commandCursor).toBe(18);
  });

  it.each(["visibilitychange", "pagehide", "freeze"])(
    "flushes synchronously on %s, before any debounce elapses",
    (event) => {
      const { entries, storage } = memoryStorage();
      const manager = new HomeUiStateManager();
      // Long enough that the trailing write can never be what saves the draft.
      const persistence = new ComposerDraftPersistence({ storage, now: () => NOW, debounceMs: 10_000 });
      const documentTarget = flushTarget("hidden");
      const windowTarget = flushTarget();
      persistence.attach(manager, { documentTarget, windowTarget });

      manager.setComposerDraft({ command: "closing the app now", commandCursor: 19 });
      expect(entries.has(COMPOSER_DRAFTS_STORAGE_KEY)).toBe(false);

      // The mobile back gesture: the webview is hidden, then destroyed without
      // ever running the trailing write.
      (event === "pagehide" ? windowTarget : documentTarget).dispatch(event);

      expect(readDrafts(entries)[NEW_CONVERSATION_DRAFT_KEY]?.command).toBe("closing the app now");
    },
  );

  it("ignores visibilitychange while the document is still visible", () => {
    const { entries, storage } = memoryStorage();
    const manager = new HomeUiStateManager();
    const documentTarget = flushTarget("visible");
    new ComposerDraftPersistence({ storage, now: () => NOW, debounceMs: 10_000 })
      .attach(manager, { documentTarget, windowTarget: flushTarget() });

    manager.setComposerDraft({ command: "still typing", commandCursor: 12 });
    documentTarget.dispatch("visibilitychange");

    expect(entries.has(COMPOSER_DRAFTS_STORAGE_KEY)).toBe(false);
  });

  it("removes its listeners on detach", () => {
    const { storage } = memoryStorage();
    const documentTarget = flushTarget();
    const windowTarget = flushTarget();
    const detach = persistenceFor(storage)
      .attach(new HomeUiStateManager(), { documentTarget, windowTarget });

    expect(documentTarget.listenerCount() + windowTarget.listenerCount()).toBeGreaterThan(0);
    detach();
    expect(documentTarget.listenerCount() + windowTarget.listenerCount()).toBe(0);
  });

  it("restores per-run drafts without clobbering text already in the composer", () => {
    const { storage } = memoryStorage({
      [COMPOSER_DRAFTS_STORAGE_KEY]: JSON.stringify({
        version: 1,
        drafts: {
          "run-a": { command: "saved for A", commandCursor: 11, updatedAt: NOW - 1_000 },
          [NEW_CONVERSATION_DRAFT_KEY]: { command: "saved for new", commandCursor: 13, updatedAt: NOW - 1_000 },
        },
      }),
    });

    const manager = new HomeUiStateManager();
    manager.setComposerDraft({ command: "typed since mount", commandCursor: 17 });
    persistenceFor(storage).hydrate(manager);

    expect(manager.getSnapshot().command).toBe("typed since mount");
    manager.selectRun("run-a");
    expect(manager.getSnapshot().command).toBe("saved for A");
  });

  it("clears storage once every draft has been sent", () => {
    const { entries, storage } = memoryStorage();
    const manager = new HomeUiStateManager();
    const detach = persistenceFor(storage).attach(manager);

    manager.setComposerDraft({ command: "about to send", commandCursor: 13 });
    manager.setComposerDraft({ command: "", commandCursor: 0 });
    detach();

    expect(entries.has(COMPOSER_DRAFTS_STORAGE_KEY)).toBe(false);
  });

  it("survives a storage that refuses reads and writes", () => {
    const hostile: BrowserStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const manager = new HomeUiStateManager();
    const persistence = persistenceFor(hostile);

    expect(() => persistence.hydrate(manager)).not.toThrow();
    const detach = persistence.attach(manager);
    manager.setComposerDraft({ command: "still typeable", commandCursor: 14 });
    expect(() => detach()).not.toThrow();
    expect(manager.getSnapshot().command).toBe("still typeable");
  });
});
