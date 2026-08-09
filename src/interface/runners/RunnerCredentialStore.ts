import { safeSetBrowserStorageItem } from "@/lib/browser-storage";

const CREDENTIAL_STORAGE_KEY = "omniharness.runnerCredentials";
const CREDENTIAL_SCHEMA_VERSION = 1;

type CredentialStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RunnerCredentialBinding = {
  origin: string;
  runnerInstanceId: string | null;
};

export type RunnerCredentialMetadata = RunnerCredentialBinding & {
  handle: string;
  profileId: string;
};

export interface RunnerCredentialStore {
  authorizeNative?(input: RunnerCredentialBinding & {
    profileId: string;
    password: string;
    clientLabel: string;
  }): Promise<string>;
  confirmTls?(input: {
    profileId: string;
    origin: string;
    fingerprint: string;
  }): Promise<void>;
  save(input: RunnerCredentialBinding & {
    profileId: string;
    token: string;
  }): Promise<string>;
  metadata(handle: string): Promise<RunnerCredentialMetadata | null>;
  rebind(handle: string, binding: RunnerCredentialBinding): Promise<void>;
  useCredential<T>(
    handle: string,
    binding: RunnerCredentialBinding,
    consumer: (token: string) => T | Promise<T>,
  ): Promise<T>;
  clear(handle: string): Promise<void>;
  clearForProfile(profileId: string): Promise<void>;
  getRecoveryNoticeCode(): string | null;
}

type StoredCredential = RunnerCredentialMetadata & {
  token: string;
};

type CredentialDocument = {
  schemaVersion: number;
  credentials: Record<string, StoredCredential>;
};

function defaultStorage(): CredentialStorage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage;
}

function createUuid() {
  return globalThis.crypto.randomUUID();
}

function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (url.username || url.password) {
    throw new TypeError("Server origins cannot contain credentials.");
  }
  return url.origin;
}

function emptyDocument(): CredentialDocument {
  return { schemaVersion: CREDENTIAL_SCHEMA_VERSION, credentials: {} };
}

function parseDocument(raw: string | null): CredentialDocument {
  if (!raw) {
    return emptyDocument();
  }
  const parsed = JSON.parse(raw) as Partial<CredentialDocument>;
  if (
    parsed.schemaVersion !== CREDENTIAL_SCHEMA_VERSION
    || !parsed.credentials
    || typeof parsed.credentials !== "object"
    || Array.isArray(parsed.credentials)
  ) {
    throw new TypeError("Unsupported credential store.");
  }
  const credentials: Record<string, StoredCredential> = {};
  for (const [handle, value] of Object.entries(parsed.credentials)) {
    if (
      value
      && typeof value === "object"
      && typeof value.handle === "string"
      && value.handle === handle
      && typeof value.profileId === "string"
      && typeof value.origin === "string"
      && (typeof value.runnerInstanceId === "string" || value.runnerInstanceId === null)
      && typeof value.token === "string"
      && value.token.length > 0
    ) {
      credentials[handle] = {
        ...value,
        origin: canonicalOrigin(value.origin),
      };
    }
  }
  return { schemaVersion: CREDENTIAL_SCHEMA_VERSION, credentials };
}

export class WebRunnerCredentialStore implements RunnerCredentialStore {
  private readonly storage: CredentialStorage | null;
  private readonly randomUUID: () => string;
  private document: CredentialDocument;
  private recoveryNoticeCode: string | null = null;

  constructor(options: {
    storage?: CredentialStorage | null;
    randomUUID?: () => string;
  } = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.randomUUID = options.randomUUID ?? createUuid;
    try {
      this.document = parseDocument(this.storage?.getItem(CREDENTIAL_STORAGE_KEY) ?? null);
    } catch {
      this.document = emptyDocument();
      this.recoveryNoticeCode = "runner.credentials.corruptReset";
      try {
        safeSetBrowserStorageItem(this.storage, CREDENTIAL_STORAGE_KEY, JSON.stringify(this.document));
      } catch {
        // The in-memory session store remains usable when browser storage is unavailable.
      }
    }
  }

  getRecoveryNoticeCode() {
    return this.recoveryNoticeCode;
  }

  private persist(next: CredentialDocument) {
    safeSetBrowserStorageItem(this.storage, CREDENTIAL_STORAGE_KEY, JSON.stringify(next));
    this.document = next;
  }

  async save(input: RunnerCredentialBinding & { profileId: string; token: string }) {
    const token = input.token.trim();
    if (!token) {
      throw new TypeError("Credential token is required.");
    }
    const handle = this.randomUUID();
    const credential: StoredCredential = {
      handle,
      profileId: input.profileId,
      origin: canonicalOrigin(input.origin),
      runnerInstanceId: input.runnerInstanceId,
      token,
    };
    this.persist({
      ...this.document,
      credentials: {
        ...this.document.credentials,
        [handle]: credential,
      },
    });
    return handle;
  }

  async metadata(handle: string) {
    const credential = this.document.credentials[handle];
    if (!credential) {
      return null;
    }
    return {
      handle: credential.handle,
      profileId: credential.profileId,
      origin: credential.origin,
      runnerInstanceId: credential.runnerInstanceId,
    };
  }

  async useCredential<T>(
    handle: string,
    binding: RunnerCredentialBinding,
    consumer: (token: string) => T | Promise<T>,
  ) {
    const credential = this.document.credentials[handle];
    if (!credential) {
      throw new Error("Credential is no longer available.");
    }
    if (credential.origin !== canonicalOrigin(binding.origin)) {
      throw new Error("Credential binding does not match the server origin.");
    }
    if (credential.runnerInstanceId !== binding.runnerInstanceId) {
      throw new Error("Credential identity does not match the server identity.");
    }
    return consumer(credential.token);
  }

  async rebind(handle: string, binding: RunnerCredentialBinding) {
    const credential = this.document.credentials[handle];
    if (!credential) {
      throw new Error("Credential is no longer available.");
    }
    if (credential.origin !== canonicalOrigin(binding.origin)) {
      throw new Error("Credential binding does not match the server origin.");
    }
    this.persist({
      ...this.document,
      credentials: {
        ...this.document.credentials,
        [handle]: {
          ...credential,
          runnerInstanceId: binding.runnerInstanceId,
        },
      },
    });
  }

  async clear(handle: string) {
    if (!this.document.credentials[handle]) {
      return;
    }
    const credentials = { ...this.document.credentials };
    delete credentials[handle];
    this.persist({ ...this.document, credentials });
  }

  async clearForProfile(profileId: string) {
    const credentials = Object.fromEntries(
      Object.entries(this.document.credentials).filter(
        ([, credential]) => credential.profileId !== profileId,
      ),
    );
    if (Object.keys(credentials).length === Object.keys(this.document.credentials).length) {
      return;
    }
    this.persist({ ...this.document, credentials });
  }
}
