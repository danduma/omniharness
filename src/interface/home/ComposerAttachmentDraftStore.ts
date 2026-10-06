import type { ChatAttachmentKind } from "@/lib/chat-attachments";

/**
 * Pending attachments hold `File` handles, which localStorage cannot carry.
 * IndexedDB structured-clones `File`s natively, so the bytes live here while
 * the localStorage draft records which attachment ids belong to it.
 */
export type StoredComposerAttachment = {
  id: string;
  kind: ChatAttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  file: File;
};

export interface ComposerAttachmentDraftStore {
  readAll(): Promise<Record<string, StoredComposerAttachment[]>>;
  put(draftKey: string, attachments: StoredComposerAttachment[]): void;
  delete(draftKey: string): void;
}

const DATABASE_NAME = "omni-composer-attachments";
const DATABASE_VERSION = 1;
const OBJECT_STORE = "drafts";

type StoredDraftRecord = {
  draftKey: string;
  attachments: StoredComposerAttachment[];
};

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function isStoredAttachment(value: unknown): value is StoredComposerAttachment {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<StoredComposerAttachment>;
  return typeof record.id === "string"
    && (record.kind === "image" || record.kind === "file")
    && typeof record.name === "string"
    && typeof record.mimeType === "string"
    && typeof record.size === "number"
    && typeof Blob !== "undefined"
    && record.file instanceof Blob;
}

export class IndexedDbComposerAttachmentDraftStore implements ComposerAttachmentDraftStore {
  private database: Promise<IDBDatabase | null> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  // Every operation chains off the same connection promise, so transactions are
  // created in call order and IndexedDB runs overlapping ones in that order: a
  // put followed by a delete for the same draft can never land reversed.
  private open() {
    this.database ??= new Promise<IDBDatabase | null>((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
      } catch {
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
          request.result.createObjectStore(OBJECT_STORE, { keyPath: "draftKey" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      // Private browsing and blocked storage refuse the open; drafts then keep
      // their text and lose only the attachments, as before.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.database;
  }

  async readAll() {
    const database = await this.open();
    if (!database) return {};
    try {
      const records = await requestToPromise(
        database.transaction(OBJECT_STORE, "readonly").objectStore(OBJECT_STORE).getAll(),
      ) as unknown[];
      const drafts: Record<string, StoredComposerAttachment[]> = {};
      for (const record of records) {
        if (!record || typeof record !== "object") continue;
        const { draftKey, attachments } = record as Partial<StoredDraftRecord>;
        if (typeof draftKey !== "string" || !Array.isArray(attachments)) continue;
        drafts[draftKey] = attachments.filter(isStoredAttachment);
      }
      return drafts;
    } catch {
      return {};
    }
  }

  put(draftKey: string, attachments: StoredComposerAttachment[]) {
    this.write((store) => store.put({ draftKey, attachments } satisfies StoredDraftRecord));
  }

  delete(draftKey: string) {
    this.write((store) => store.delete(draftKey));
  }

  private write(operation: (store: IDBObjectStore) => void) {
    void this.open().then((database) => {
      if (!database) return;
      try {
        operation(database.transaction(OBJECT_STORE, "readwrite").objectStore(OBJECT_STORE));
      } catch {
        // Quota or a closed connection: the attachment stays usable in memory
        // for this page; only its survival across a reload is lost.
      }
    });
  }
}

export function getBrowserComposerAttachmentDraftStore(): ComposerAttachmentDraftStore | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    return new IndexedDbComposerAttachmentDraftStore(indexedDB);
  } catch {
    return null;
  }
}
