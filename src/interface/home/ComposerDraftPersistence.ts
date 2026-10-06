import {
  getBrowserLocalStorage,
  safeSetBrowserStorageItem,
  type BrowserStorage,
} from "@/lib/browser-storage";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import {
  getBrowserComposerAttachmentDraftStore,
  type ComposerAttachmentDraftStore,
  type StoredComposerAttachment,
} from "./ComposerAttachmentDraftStore";
import {
  NEW_CONVERSATION_DRAFT_KEY,
  pendingChatAttachmentFromFile,
  type ComposerSelection,
  type ComposerSelectionField,
  type HomeUiState,
  type HomeUiStateManager,
} from "./HomeUiStateManager";

export const COMPOSER_DRAFTS_STORAGE_KEY = "omni-composer-drafts:v2";

/**
 * Unsent composer text and attachments are the client state a user cannot get
 * back from the server, so they outlive the document. Attachments are `File`
 * handles that localStorage cannot hold: the draft records their ids, and the
 * bytes live in the IndexedDB `ComposerAttachmentDraftStore`.
 */
export type PersistedComposerDraft = {
  command: string;
  commandCursor: number;
  selection: ComposerSelection;
  dirtySelectionFields: ComposerSelectionField[];
  serverSelectionVersion: string | null;
  attachmentIds?: string[];
  updatedAt: number;
};

type PersistedComposerDraftsEnvelope = {
  version: 2;
  drafts: Record<string, PersistedComposerDraft>;
};

export type ComposerDraftSource = Pick<
  HomeUiState,
  | "command"
  | "commandCursor"
  | "attachments"
  | "selectedRunId"
  | "composerDraftsByRun"
  | "selectedConversationMode"
  | "selectedCliAgent"
  | "selectedWorkerAccountId"
  | "selectedModel"
  | "selectedEffort"
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
  if (typeof record.command !== "string") {
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

  const selection = record.selection;
  if (!selection || typeof selection !== "object") return null;
  if (
    typeof selection.conversationMode !== "string"
    || typeof selection.worker !== "string"
    || typeof selection.accountId !== "string"
    || typeof selection.model !== "string"
    || typeof selection.effort !== "string"
  ) return null;
  const dirtySelectionFields = Array.isArray(record.dirtySelectionFields)
    ? record.dirtySelectionFields.filter((field): field is ComposerSelectionField => (
        field === "conversationMode" || field === "worker" || field === "accountId" || field === "model" || field === "effort"
      ))
    : [];
  const attachmentIds = Array.isArray(record.attachmentIds)
    ? record.attachmentIds.filter((id): id is string => typeof id === "string")
    : [];
  if (record.command.length === 0 && dirtySelectionFields.length === 0 && attachmentIds.length === 0) return null;

  return {
    command: record.command,
    commandCursor: Math.min(Math.max(Math.trunc(cursor), 0), record.command.length),
    selection: selection as ComposerSelection,
    dirtySelectionFields,
    serverSelectionVersion: typeof record.serverSelectionVersion === "string" ? record.serverSelectionVersion : null,
    ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
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
  if (!envelope || typeof envelope !== "object" || envelope.version !== 2) {
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

  const record = (
    key: string,
    command: string,
    commandCursor: number,
    selection: ComposerSelection,
    dirtySelectionFields: ComposerSelectionField[],
    serverSelectionVersion: string | null,
    attachments: PendingChatAttachment[],
  ) => {
    // The active composer is recorded last and replaces whatever its parked
    // copy held, including clearing it once the message has been sent.
    delete drafts[key];
    const attachmentIds = attachments.map((attachment) => attachment.id);
    if (command.length === 0 && dirtySelectionFields.length === 0 && attachmentIds.length === 0) {
      return;
    }
    const prior = previous[key];
    const unchanged = prior
      && prior.command === command
      && prior.commandCursor === commandCursor
      && JSON.stringify(prior.selection) === JSON.stringify(selection)
      && JSON.stringify(prior.dirtySelectionFields) === JSON.stringify(dirtySelectionFields)
      && prior.serverSelectionVersion === serverSelectionVersion
      && JSON.stringify(prior.attachmentIds ?? []) === JSON.stringify(attachmentIds);
    drafts[key] = unchanged
      ? prior
      : {
          command,
          commandCursor,
          selection,
          dirtySelectionFields,
          serverSelectionVersion,
          ...(attachmentIds.length > 0 ? { attachmentIds } : {}),
          updatedAt: now,
        };
  };

  for (const [key, draft] of Object.entries(state.composerDraftsByRun)) {
    record(
      key,
      draft.command,
      draft.commandCursor,
      draft.selection,
      draft.dirtySelectionFields,
      draft.serverSelectionVersion,
      draft.attachments,
    );
  }
  const activeStored = state.composerDraftsByRun[composerDraftKey(state.selectedRunId)];
  record(
    composerDraftKey(state.selectedRunId),
    state.command,
    state.commandCursor,
    {
      conversationMode: state.selectedConversationMode,
      worker: state.selectedCliAgent,
      accountId: state.selectedWorkerAccountId,
      model: state.selectedModel,
      effort: state.selectedEffort,
    },
    activeStored?.dirtySelectionFields ?? [],
    activeStored?.serverSelectionVersion ?? null,
    state.attachments,
  );

  return drafts;
}

/** Live attachments per draft key, using the same active-wins rule as the text. */
export function collectComposerAttachments(state: Pick<HomeUiState, "selectedRunId" | "attachments" | "composerDraftsByRun">) {
  const attachments = new Map<string, PendingChatAttachment[]>();
  for (const [key, draft] of Object.entries(state.composerDraftsByRun)) {
    if (draft.attachments.length > 0) {
      attachments.set(key, draft.attachments);
    }
  }
  const activeKey = composerDraftKey(state.selectedRunId);
  if (state.attachments.length > 0) {
    attachments.set(activeKey, state.attachments);
  } else {
    attachments.delete(activeKey);
  }
  return attachments;
}

function attachmentSignature(attachments: Array<{ id: string }>) {
  return attachments.map((attachment) => attachment.id).join("\n");
}

export function serializeComposerDrafts(
  drafts: Record<string, PersistedComposerDraft>,
  activeKey: string,
) {
  const stringify = (entries: Array<[string, PersistedComposerDraft]>) => JSON.stringify({
    version: 2,
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
  attachmentStore?: ComposerAttachmentDraftStore | null;
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
  private explicitAttachmentStore: ComposerAttachmentDraftStore | null | undefined;
  private readonly now: () => number;
  private readonly debounceMs: number;
  private manager: HomeUiStateManager | null = null;
  private lastWritten: Record<string, PersistedComposerDraft> = {};
  private lastSerialized: string | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  // What the attachment store holds per draft key, as ordered attachment ids.
  private storedAttachmentSignatures = new Map<string, string>();
  // Until stored attachments are back in the composer, a write would see empty
  // attachment lists and erase the very drafts being restored.
  private pendingAttachmentHydrations = 0;
  private writeDeferredByHydration = false;

  constructor(options: ComposerDraftPersistenceOptions = {}) {
    this.explicitStorage = options.storage;
    this.explicitAttachmentStore = options.attachmentStore;
    this.now = options.now ?? Date.now;
    this.debounceMs = options.debounceMs ?? WRITE_DEBOUNCE_MS;
  }

  // The module singleton is constructed during SSR too, so the real storage
  // handle is resolved per call rather than captured at construction.
  private get storage() {
    return this.explicitStorage === undefined ? getBrowserLocalStorage() : this.explicitStorage;
  }

  // Resolved once in the browser because the store owns a database connection.
  private get attachmentStore() {
    if (this.explicitAttachmentStore === undefined && typeof window !== "undefined") {
      this.explicitAttachmentStore = getBrowserComposerAttachmentDraftStore();
    }
    return this.explicitAttachmentStore ?? null;
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
   * live state is newer than storage by definition, so it wins. Text lands
   * synchronously; attachments follow once IndexedDB answers.
   */
  hydrate(manager: HomeUiStateManager): Promise<void> {
    const persisted = this.read();
    this.restoreText(manager, persisted);
    return this.restoreAttachments(manager, persisted);
  }

  private restoreText(manager: HomeUiStateManager, persisted: Record<string, PersistedComposerDraft>) {
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
          selection: draft.selection,
          dirtySelectionFields: draft.dirtySelectionFields,
          serverSelectionVersion: draft.serverSelectionVersion,
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
          ? {
              command: activeDraft.command,
              commandCursor: activeDraft.commandCursor,
              selectedConversationMode: activeDraft.selection.conversationMode,
              selectedCliAgent: activeDraft.selection.worker,
              selectedWorkerAccountId: activeDraft.selection.accountId,
              selectedModel: activeDraft.selection.model,
              selectedEffort: activeDraft.selection.effort,
            }
          : {}),
      };
    });
  }

  private async restoreAttachments(manager: HomeUiStateManager, persisted: Record<string, PersistedComposerDraft>) {
    const store = this.attachmentStore;
    if (!store) {
      return;
    }

    this.pendingAttachmentHydrations += 1;
    try {
      const stored = await store.readAll();
      for (const [key, attachments] of Object.entries(stored)) {
        // Entries the draft index no longer references are pruned by the next
        // write, which compares live attachments against these signatures.
        this.storedAttachmentSignatures.set(key, attachmentSignature(attachments));
        const draft = persisted[key];
        if (!draft?.attachmentIds) continue;
        const byId = new Map(attachments.map((attachment) => [attachment.id, attachment]));
        const restored = draft.attachmentIds
          .map((id) => byId.get(id))
          .filter((attachment): attachment is StoredComposerAttachment => Boolean(attachment));
        if (restored.length > 0) {
          this.restoreDraftAttachments(manager, key, draft.command, restored);
        }
      }
    } catch {
      // Unreadable attachment storage leaves the restored text in place.
    } finally {
      this.pendingAttachmentHydrations -= 1;
      if (this.pendingAttachmentHydrations === 0 && this.writeDeferredByHydration) {
        this.writeDeferredByHydration = false;
        this.write();
      }
    }
  }

  // Only fills a draft that still holds the text it was saved with and has no
  // attachments of its own; anything else means the user moved on meanwhile.
  private restoreDraftAttachments(
    manager: HomeUiStateManager,
    key: string,
    command: string,
    stored: StoredComposerAttachment[],
  ) {
    const toPending = () => stored.map((attachment) => pendingChatAttachmentFromFile(attachment.file, attachment.id));
    manager.update((current) => {
      if (key === composerDraftKey(current.selectedRunId)) {
        if (current.attachments.length > 0 || current.command !== command) return current;
        return { ...current, attachments: toPending() };
      }
      const draft = current.composerDraftsByRun[key];
      if (!draft || draft.attachments.length > 0 || draft.command !== command) return current;
      return {
        ...current,
        composerDraftsByRun: { ...current.composerDraftsByRun, [key]: { ...draft, attachments: toPending() } },
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
    if (this.pendingAttachmentHydrations > 0) {
      this.writeDeferredByHydration = true;
      return;
    }

    const snapshot = manager.getSnapshot();
    this.writeAttachments(snapshot);
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

  private writeAttachments(snapshot: HomeUiState) {
    const store = this.attachmentStore;
    if (!store) {
      return;
    }

    const live = collectComposerAttachments(snapshot);
    for (const [key, attachments] of live) {
      const signature = attachmentSignature(attachments);
      if (this.storedAttachmentSignatures.get(key) === signature) continue;
      store.put(key, attachments.map(({ id, kind, name, mimeType, size, file }) => ({ id, kind, name, mimeType, size, file })));
      this.storedAttachmentSignatures.set(key, signature);
    }
    for (const key of [...this.storedAttachmentSignatures.keys()]) {
      if (live.has(key)) continue;
      store.delete(key);
      this.storedAttachmentSignatures.delete(key);
    }
  }
}

export const composerDraftPersistence = new ComposerDraftPersistence();
