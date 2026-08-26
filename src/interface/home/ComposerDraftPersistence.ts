import {
  getBrowserLocalStorage,
  safeSetBrowserStorageItem,
  type BrowserStorage,
} from "@/lib/browser-storage";
import { NEW_CONVERSATION_DRAFT_KEY, type HomeUiState, type HomeUiStateManager } from "./HomeUiStateManager";

export const COMPOSER_DRAFTS_STORAGE_KEY = "omni-composer-drafts:v1";

/**
 * Unsent composer text is the one piece of client state a user cannot get back
 * from the server, so it outlives the document. Attachments are `File` handles
 * that cannot be revived from storage, so they stay in memory only.
 */
export type PersistedComposerDraft = {
  command: string;
  commandCursor: number;
  updatedAt: number;
};

type PersistedComposerDraftsEnvelope = {
  version: 1;
  drafts: Record<string, PersistedComposerDraft>;
};

export type ComposerDraftSource = Pick<
  HomeUiState,
  "command" | "commandCursor" | "selectedRunId" | "composerDraftsByRun"
>;

const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_PERSISTED_DRAFTS = 50;
const MAX_SERIALIZED_LENGTH = 256_000;
// Writing to localStorage on every keystroke blocks the main thread, which is
// visible while typing on mobile. Steady-state edits coalesce into one trailing
// write, and every teardown signal flushes synchronously — that flush is the
// case this whole module exists for.
const WRITE_DEBOUNCE_MS = 400;

export function composerDraftKey(selectedRunId: string | null) {
  return selectedRunId ?? NEW_CONVERSATION_DRAFT_KEY;
}

function readPersistedDraft(value: unknown, now: number): PersistedComposerDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Partial<PersistedComposerDraft>;
  if (typeof record.command !== "string" || record.command.length === 0) {
    return null;
  }
  if (typeof record.updatedAt !== "number" || !Number.isFinite(record.updatedAt)) {
    return null;
  }
  if (now - record.updatedAt > DRAFT_TTL_MS) {
    return null;
  }

  const cursor = typeof record.commandCursor === "number" && Number.isFinite(record.commandCursor)
    ? record.commandCursor
    : record.command.length;

  return {
    command: record.command,
    commandCursor: Math.min(Math.max(Math.trunc(cursor), 0), record.command.length),
    updatedAt: record.updatedAt,
  };
}

export function parsePersistedComposerDrafts(raw: string | null, now: number) {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // A corrupt entry is disposable: the next write replaces it.
    return {};
  }

  const envelope = parsed as Partial<PersistedComposerDraftsEnvelope> | null;
  if (!envelope || typeof envelope !== "object" || envelope.version !== 1) {
    return {};
  }
  if (!envelope.drafts || typeof envelope.drafts !== "object") {
    return {};
  }

  const drafts: Record<string, PersistedComposerDraft> = {};
  for (const [key, value] of Object.entries(envelope.drafts)) {
    const draft = readPersistedDraft(value, now);
    if (draft) {
      drafts[key] = draft;
    }
  }
  return drafts;
}

/**
 * `composerDraftsByRun` only receives the active composer when the run
 * selection changes, so the live `command`/`commandCursor` fields have to be
 * folded in separately. Timestamps are carried over for unchanged drafts so an
 * untouched conversation does not keep refreshing its own expiry.
 */
export function collectComposerDrafts(
  state: ComposerDraftSource,
  now: number,
  previous: Record<string, PersistedComposerDraft> = {},
) {
  const drafts: Record<string, PersistedComposerDraft> = {};

  const record = (key: string, command: string, commandCursor: number) => {
    if (command.length === 0) {
      return;
    }
    const prior = previous[key];
    drafts[key] = prior && prior.command === command && prior.commandCursor === commandCursor
      ? prior
      : { command, commandCursor, updatedAt: now };
  };

  for (const [key, draft] of Object.entries(state.composerDraftsByRun)) {
    record(key, draft.command, draft.commandCursor);
  }
  record(composerDraftKey(state.selectedRunId), state.command, state.commandCursor);

  return drafts;
}

export function serializeComposerDrafts(
  drafts: Record<string, PersistedComposerDraft>,
  activeKey: string,
) {
  const stringify = (entries: Array<[string, PersistedComposerDraft]>) => JSON.stringify({
    version: 1,
    drafts: Object.fromEntries(entries),
  } satisfies PersistedComposerDraftsEnvelope);

  // Newest first so eviction drops the stalest conversations, but the composer
  // the user is looking at is never a candidate.
  const ordered = Object.entries(drafts).sort((a, b) => {
    if (a[0] === activeKey) return -1;
    if (b[0] === activeKey) return 1;
    return b[1].updatedAt - a[1].updatedAt;
  });

  let kept = ordered.slice(0, MAX_PERSISTED_DRAFTS);
  let serialized = stringify(kept);
  while (kept.length > 1 && serialized.length > MAX_SERIALIZED_LENGTH) {
    kept = kept.slice(0, -1);
    serialized = stringify(kept);
  }
  return serialized;
}

export type ComposerDraftPersistenceOptions = {
  storage?: BrowserStorage | null;
  now?: () => number;
  debounceMs?: number;
};

type DraftFlushTarget = {
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

/** Injectable so the teardown flush can be exercised without a DOM. */
export type ComposerDraftAttachOptions = {
  documentTarget?: (DraftFlushTarget & { readonly visibilityState: string }) | null;
  windowTarget?: DraftFlushTarget | null;
};

export class ComposerDraftPersistence {
  private readonly explicitStorage: BrowserStorage | null | undefined;
  private readonly now: () => number;
  private readonly debounceMs: number;
  private manager: HomeUiStateManager | null = null;
  private lastWritten: Record<string, PersistedComposerDraft> = {};
  private lastSerialized: string | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: ComposerDraftPersistenceOptions = {}) {
    this.explicitStorage = options.storage;
    this.now = options.now ?? Date.now;
    this.debounceMs = options.debounceMs ?? WRITE_DEBOUNCE_MS;
  }

  // The module singleton is constructed during SSR too, so the real storage
  // handle is resolved per call rather than captured at construction.
  private get storage() {
    return this.explicitStorage === undefined ? getBrowserLocalStorage() : this.explicitStorage;
  }

  read() {
    const storage = this.storage;
    if (!storage) {
      return {};
    }

    let raw: string | null = null;
    try {
      raw = storage.getItem(COMPOSER_DRAFTS_STORAGE_KEY);
    } catch {
      return {};
    }

    this.lastSerialized = raw;
    this.lastWritten = parsePersistedComposerDrafts(raw, this.now());
    return this.lastWritten;
  }

  /**
   * Restores saved text without clobbering anything already in the composer:
   * live state is newer than storage by definition, so it wins.
   */
  hydrate(manager: HomeUiStateManager) {
    const persisted = this.read();
    if (Object.keys(persisted).length === 0) {
      return;
    }

    manager.update((current) => {
      const activeKey = composerDraftKey(current.selectedRunId);
      const composerDraftsByRun = { ...current.composerDraftsByRun };
      let restoredAnyRun = false;

      for (const [key, draft] of Object.entries(persisted)) {
        if (key === activeKey || composerDraftsByRun[key]) {
          continue;
        }
        composerDraftsByRun[key] = {
          command: draft.command,
          commandCursor: draft.commandCursor,
          mentionIndex: 0,
          attachments: [],
        };
        restoredAnyRun = true;
      }

      const activeDraft = current.command.length === 0 ? persisted[activeKey] : undefined;
      if (!restoredAnyRun && !activeDraft) {
        return current;
      }

      return {
        ...current,
        composerDraftsByRun,
        ...(activeDraft
          ? { command: activeDraft.command, commandCursor: activeDraft.commandCursor }
          : {}),
      };
    });
  }

  attach(manager: HomeUiStateManager, options: ComposerDraftAttachOptions = {}) {
    this.manager = manager;
    const unsubscribe = manager.subscribe(() => this.schedule());

    const documentTarget = options.documentTarget === undefined
      ? (typeof document === "undefined" ? null : document)
      : options.documentTarget;
    const windowTarget = options.windowTarget === undefined
      ? (typeof window === "undefined" ? null : window)
      : options.windowTarget;

    const detach = () => {
      unsubscribe();
      this.flush();
      this.manager = null;
    };

    if (!documentTarget || !windowTarget) {
      return detach;
    }

    // A mobile back gesture destroys the webview without running unload
    // handlers. `visibilitychange` is the last callback that reliably fires
    // before the process is torn down, so it — not `beforeunload` — is what
    // keeps a half-typed prompt from disappearing.
    const flushOnHide = () => {
      if (documentTarget.visibilityState === "visible") {
        return;
      }
      this.flush();
    };
    const flushNow = () => this.flush();
    // Window blur fires constantly on desktop; only a pending write is worth
    // the synchronous storage round trip.
    const flushPending = () => {
      if (this.writeTimer !== null) {
        this.flush();
      }
    };

    documentTarget.addEventListener("visibilitychange", flushOnHide);
    // Page Lifecycle `freeze` fires on the document, not the window.
    documentTarget.addEventListener("freeze", flushNow);
    windowTarget.addEventListener("pagehide", flushNow);
    windowTarget.addEventListener("blur", flushPending);

    return () => {
      documentTarget.removeEventListener("visibilitychange", flushOnHide);
      documentTarget.removeEventListener("freeze", flushNow);
      windowTarget.removeEventListener("pagehide", flushNow);
      windowTarget.removeEventListener("blur", flushPending);
      detach();
    };
  }

  flush() {
    if (this.writeTimer !== null) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.write();
  }

  private schedule() {
    if (this.writeTimer !== null) {
      return;
    }
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.write();
    }, this.debounceMs);
  }

  private write() {
    const manager = this.manager;
    const storage = this.storage;
    if (!manager || !storage) {
      return;
    }

    const snapshot = manager.getSnapshot();
    const drafts = collectComposerDrafts(snapshot, this.now(), this.lastWritten);
    const serialized = Object.keys(drafts).length === 0
      ? null
      : serializeComposerDrafts(drafts, composerDraftKey(snapshot.selectedRunId));

    if (serialized === this.lastSerialized) {
      return;
    }

    if (serialized === null) {
      try {
        storage.removeItem(COMPOSER_DRAFTS_STORAGE_KEY);
      } catch {
        return;
      }
      this.lastWritten = {};
      this.lastSerialized = null;
      return;
    }

    if (!safeSetBrowserStorageItem(storage, COMPOSER_DRAFTS_STORAGE_KEY, serialized)) {
      return;
    }
    this.lastWritten = drafts;
    this.lastSerialized = serialized;
  }
}

export const composerDraftPersistence = new ComposerDraftPersistence();
