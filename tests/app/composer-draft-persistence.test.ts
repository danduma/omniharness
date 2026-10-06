import { describe, expect, it } from "vitest";
import type { BrowserStorage } from "@/lib/browser-storage";
import type { ComposerAttachmentDraftStore, StoredComposerAttachment } from "@/interface/home/ComposerAttachmentDraftStore";
import {
  COMPOSER_DRAFTS_STORAGE_KEY,
  ComposerDraftPersistence,
  collectComposerDrafts,
  parsePersistedComposerDrafts,
  serializeComposerDrafts,
} from "@/interface/home/ComposerDraftPersistence";
import { HomeUiStateManager, NEW_CONVERSATION_DRAFT_KEY } from "@/interface/home/HomeUiStateManager";

const NOW = 1_800_000_000_000;
const SELECTION = {
  conversationMode: "direct" as const,
  worker: "auto" as const,
  accountId: "auto",
  model: "gpt-5.6-sol",
  effort: "High",
};

function composerDraft(command: string, commandCursor: number) {
  return {
    command,
    commandCursor,
    mentionIndex: 0,
    attachments: [],
    selection: SELECTION,
    dirtySelectionFields: [],
    serverSelectionVersion: null,
  };
}

function persistedDraft(command: string, commandCursor: number, updatedAt = NOW) {
  return {
    command,
    commandCursor,
    selection: SELECTION,
    dirtySelectionFields: [],
    serverSelectionVersion: null,
    updatedAt,
  };
}

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

function memoryAttachmentStore(seed: Record<string, StoredComposerAttachment[]> = {}) {
  const entries = new Map(Object.entries(seed));
  let release: (() => void) | null = null;
  const store: ComposerAttachmentDraftStore & { hold(): void; release(): void } = {
    readAll: async () => {
      if (release === null) {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return Object.fromEntries(entries);
    },
    put: (key, attachments) => {
      entries.set(key, attachments);
    },
    delete: (key) => {
      entries.delete(key);
    },
    // Reads resolve immediately unless the test holds them to inspect the
    // window while IndexedDB has not answered yet.
    hold: () => {
      release = null;
    },
    release: () => {
      const pending = release;
      release = () => {};
      pending?.();
    },
  };
  store.release();
  return { entries, store };
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
      selectedConversationMode: "direct",
      selectedCliAgent: "auto",
      selectedWorkerAccountId: "auto",
      selectedModel: "gpt-5.6-sol",
      selectedEffort: "High",
      attachments: [],
      composerDraftsByRun: {
        "run-a": composerDraft("parked", 6),
      },
    }, NOW);

    expect(drafts).toEqual({
      "run-a": persistedDraft("parked", 6),
      [NEW_CONVERSATION_DRAFT_KEY]: persistedDraft("half-typed prompt", 4),
    });
  });

  it("omits empty composers so a sent message clears its draft", () => {
    const drafts = collectComposerDrafts({
      command: "",
      commandCursor: 0,
      selectedRunId: "run-a",
      selectedConversationMode: "direct",
      selectedCliAgent: "auto",
      selectedWorkerAccountId: "auto",
      selectedModel: "gpt-5.6-sol",
      selectedEffort: "High",
      attachments: [],
      composerDraftsByRun: {},
    }, NOW);

    expect(drafts).toEqual({});
  });

  it("keeps the original timestamp when a draft is unchanged", () => {
    const previous = { "run-a": persistedDraft("parked", 6, NOW - 5_000) };
    const drafts = collectComposerDrafts({
      command: "",
      commandCursor: 0,
      selectedRunId: null,
      selectedConversationMode: "direct",
      selectedCliAgent: "auto",
      selectedWorkerAccountId: "auto",
      selectedModel: "gpt-5.6-sol",
      selectedEffort: "High",
      attachments: [],
      composerDraftsByRun: {
        "run-a": composerDraft("parked", 6),
      },
    }, NOW, previous);

    expect(drafts["run-a"].updatedAt).toBe(NOW - 5_000);
  });
});

describe("parsePersistedComposerDrafts", () => {
  it("returns nothing for malformed or foreign-version payloads", () => {
    expect(parsePersistedComposerDrafts(null, NOW)).toEqual({});
    expect(parsePersistedComposerDrafts("{not json", NOW)).toEqual({});
    expect(parsePersistedComposerDrafts(JSON.stringify({ version: 1, drafts: {} }), NOW)).toEqual({});
  });

  it("drops expired drafts and clamps cursors into the restored text", () => {
    const raw = JSON.stringify({
      version: 2,
      drafts: {
        stale: persistedDraft("old", 3, NOW - 40 * 24 * 60 * 60 * 1000),
        fresh: persistedDraft("kept", 9999, NOW - 1_000),
      },
    });

    expect(parsePersistedComposerDrafts(raw, NOW)).toEqual({
      fresh: persistedDraft("kept", 4, NOW - 1_000),
    });
  });
});

describe("serializeComposerDrafts", () => {
  it("evicts the stalest drafts first and never the active composer", () => {
    const active = "a".repeat(200_000);
    const serialized = serializeComposerDrafts({
      [NEW_CONVERSATION_DRAFT_KEY]: persistedDraft(active, 0, NOW - 60_000),
      "run-old": persistedDraft("b".repeat(100_000), 0, NOW - 10_000),
      "run-new": persistedDraft("c".repeat(100_000), 0, NOW),
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
      selection: SELECTION,
      dirtySelectionFields: [],
      serverSelectionVersion: null,
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
        version: 2,
        drafts: {
          "run-a": persistedDraft("saved for A", 11, NOW - 1_000),
          [NEW_CONVERSATION_DRAFT_KEY]: persistedDraft("saved for new", 13, NOW - 1_000),
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

  describe("attachments", () => {
    const imageFile = () => new File(["png-bytes"], "screenshot.png", { type: "image/png" });
    const textFile = () => new File(["notes"], "notes.txt", { type: "text/plain" });

    function attachedPersistence(storage: BrowserStorage, attachmentStore: ComposerAttachmentDraftStore) {
      return new ComposerDraftPersistence({ storage, attachmentStore, now: () => NOW, debounceMs: 0 });
    }

    it("persists attachments with the draft and restores them into a fresh manager", async () => {
      const { entries, storage } = memoryStorage();
      const attachments = memoryAttachmentStore();
      const manager = new HomeUiStateManager();
      const detach = attachedPersistence(storage, attachments.store).attach(manager);

      manager.setComposerDraft({ command: "see attached", commandCursor: 12 });
      manager.addAttachmentFiles([imageFile(), textFile()]);
      const ids = manager.getSnapshot().attachments.map((attachment) => attachment.id);
      detach();

      expect(readDrafts(entries)[NEW_CONVERSATION_DRAFT_KEY]?.attachmentIds).toEqual(ids);
      expect(attachments.entries.get(NEW_CONVERSATION_DRAFT_KEY)?.map((attachment) => attachment.id)).toEqual(ids);

      const restored = new HomeUiStateManager();
      await attachedPersistence(storage, attachments.store).hydrate(restored);
      const snapshot = restored.getSnapshot();
      expect(snapshot.command).toBe("see attached");
      expect(snapshot.attachments.map((attachment) => attachment.id)).toEqual(ids);
      expect(snapshot.attachments.map((attachment) => attachment.name)).toEqual(["screenshot.png", "notes.txt"]);
      expect(await snapshot.attachments[1].file.text()).toBe("notes");
    });

    it("keeps a draft that holds only attachments", async () => {
      const { entries, storage } = memoryStorage();
      const attachments = memoryAttachmentStore();
      const manager = new HomeUiStateManager();
      const detach = attachedPersistence(storage, attachments.store).attach(manager);

      manager.addAttachmentFiles([imageFile()]);
      manager.selectRun("run-a");
      detach();

      expect(readDrafts(entries)[NEW_CONVERSATION_DRAFT_KEY]?.command).toBe("");

      const restored = new HomeUiStateManager();
      restored.selectRun("run-a");
      await attachedPersistence(storage, attachments.store).hydrate(restored);
      restored.selectRun(null);
      expect(restored.getSnapshot().attachments.map((attachment) => attachment.name)).toEqual(["screenshot.png"]);
    });

    it("drops stored files once the attachments are removed or sent", () => {
      const { entries, storage } = memoryStorage();
      const attachments = memoryAttachmentStore();
      const manager = new HomeUiStateManager();
      const persistence = attachedPersistence(storage, attachments.store);
      const detach = persistence.attach(manager);

      manager.addAttachmentFiles([imageFile()]);
      persistence.flush();
      expect(attachments.entries.has(NEW_CONVERSATION_DRAFT_KEY)).toBe(true);
      manager.clearAttachments();
      detach();

      expect(attachments.entries.size).toBe(0);
      expect(entries.has(COMPOSER_DRAFTS_STORAGE_KEY)).toBe(false);
    });

    it("does not erase stored attachments while they are still loading", async () => {
      const { entries, storage } = memoryStorage();
      const attachments = memoryAttachmentStore();
      const first = new HomeUiStateManager();
      const detachFirst = attachedPersistence(storage, attachments.store).attach(first);
      first.setComposerDraft({ command: "with a file", commandCursor: 11 });
      first.addAttachmentFiles([textFile()]);
      detachFirst();

      attachments.store.hold();
      const manager = new HomeUiStateManager();
      const persistence = attachedPersistence(storage, attachments.store);
      const hydrated = persistence.hydrate(manager);
      persistence.attach(manager);
      persistence.flush();

      expect(readDrafts(entries)[NEW_CONVERSATION_DRAFT_KEY]?.attachmentIds).toHaveLength(1);
      expect(attachments.entries.has(NEW_CONVERSATION_DRAFT_KEY)).toBe(true);

      attachments.store.release();
      await hydrated;
      expect(manager.getSnapshot().attachments.map((attachment) => attachment.name)).toEqual(["notes.txt"]);
      expect(attachments.entries.has(NEW_CONVERSATION_DRAFT_KEY)).toBe(true);
    });

    it("leaves attachments added since mount alone and prunes the stale stored ones", async () => {
      const staleFile = textFile();
      const { storage } = memoryStorage({
        [COMPOSER_DRAFTS_STORAGE_KEY]: JSON.stringify({
          version: 2,
          drafts: {
            [NEW_CONVERSATION_DRAFT_KEY]: { ...persistedDraft("", 0), attachmentIds: ["stale"] },
          },
        }),
      });
      const attachments = memoryAttachmentStore({
        [NEW_CONVERSATION_DRAFT_KEY]: [
          { id: "stale", kind: "file", name: "notes.txt", mimeType: "text/plain", size: staleFile.size, file: staleFile },
        ],
        orphaned: [
          { id: "orphan", kind: "file", name: "notes.txt", mimeType: "text/plain", size: staleFile.size, file: staleFile },
        ],
      });

      const manager = new HomeUiStateManager();
      manager.addAttachmentFiles([imageFile()]);
      const persistence = attachedPersistence(storage, attachments.store);
      await persistence.hydrate(manager);
      persistence.attach(manager);
      persistence.flush();

      expect(manager.getSnapshot().attachments.map((attachment) => attachment.name)).toEqual(["screenshot.png"]);
      expect(attachments.entries.get(NEW_CONVERSATION_DRAFT_KEY)?.map((attachment) => attachment.name)).toEqual(["screenshot.png"]);
      expect(attachments.entries.has("orphaned")).toBe(false);
    });
  });
});
