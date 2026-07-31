import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type ElectronCredentialBinding = {
  profileId: string;
  origin: string;
  runnerInstanceId: string | null;
};

export type ElectronCredentialMetadata = ElectronCredentialBinding & {
  handle: string;
};

type StoredCredential = ElectronCredentialMetadata & {
  encryptedToken: string;
};

type CredentialDocument = {
  schemaVersion: 1;
  credentials: Record<string, StoredCredential>;
};

export type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
};

function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (
    url.origin !== value
    || (url.protocol !== "https:" && url.protocol !== "http:")
    || url.username
    || url.password
  ) {
    throw new TypeError("Credential origin must be an exact HTTP origin.");
  }
  return url.origin;
}

function emptyDocument(): CredentialDocument {
  return { schemaVersion: 1, credentials: {} };
}

export class ElectronCredentialStore {
  private document = emptyDocument();
  private readonly sessionCredentials = new Map<
    string,
    ElectronCredentialMetadata & { token: string }
  >();
  private recoveryNoticeCode: string | null = null;

  constructor(
    private readonly filePath: string,
    private readonly safeStorage: SafeStorageLike,
  ) {
    this.load();
  }

  private load() {
    if (!fs.existsSync(this.filePath)) return;
    try {
      const value = JSON.parse(fs.readFileSync(this.filePath, "utf8")) as CredentialDocument;
      if (value.schemaVersion !== 1 || !value.credentials) {
        throw new Error("Unsupported Electron credential store.");
      }
      this.document = value;
    } catch {
      this.document = emptyDocument();
      this.recoveryNoticeCode = "runner.credentials.corruptReset";
    }
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.document)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, this.filePath);
  }

  getRecoveryNoticeCode() {
    if (!this.safeStorage.isEncryptionAvailable()) {
      return "runner.credentials.sessionOnly";
    }
    return this.recoveryNoticeCode;
  }

  save(input: ElectronCredentialBinding & { token: string }) {
    const token = input.token.trim();
    if (!token) throw new TypeError("Credential token is required.");
    const handle = randomUUID();
    const metadata: ElectronCredentialMetadata = {
      handle,
      profileId: input.profileId,
      origin: canonicalOrigin(input.origin),
      runnerInstanceId: input.runnerInstanceId,
    };
    if (this.safeStorage.isEncryptionAvailable()) {
      this.document.credentials[handle] = {
        ...metadata,
        encryptedToken: this.safeStorage.encryptString(token).toString("base64"),
      };
      this.persist();
    } else {
      this.sessionCredentials.set(handle, { ...metadata, token });
    }
    return handle;
  }

  metadata(handle: string): ElectronCredentialMetadata | null {
    const stored = this.document.credentials[handle];
    if (stored) {
      const { encryptedToken: _, ...metadata } = stored;
      return metadata;
    }
    const session = this.sessionCredentials.get(handle);
    if (!session) return null;
    const { token: _, ...metadata } = session;
    return metadata;
  }

  private assertBinding(
    metadata: ElectronCredentialMetadata,
    binding: Omit<ElectronCredentialBinding, "profileId"> & { profileId?: string },
  ) {
    if (metadata.origin !== canonicalOrigin(binding.origin)) {
      throw new Error("Credential binding does not match the runner origin.");
    }
    if (metadata.runnerInstanceId !== binding.runnerInstanceId) {
      throw new Error("Credential identity does not match the runner identity.");
    }
    if (binding.profileId && metadata.profileId !== binding.profileId) {
      throw new Error("Credential binding does not match the runner profile.");
    }
  }

  useCredential<T>(
    handle: string,
    binding: Omit<ElectronCredentialBinding, "profileId"> & { profileId?: string },
    consumer: (token: string) => T,
  ) {
    const stored = this.document.credentials[handle];
    if (stored) {
      this.assertBinding(stored, binding);
      return consumer(this.safeStorage.decryptString(
        Buffer.from(stored.encryptedToken, "base64"),
      ));
    }
    const session = this.sessionCredentials.get(handle);
    if (!session) throw new Error("Credential is no longer available.");
    this.assertBinding(session, binding);
    return consumer(session.token);
  }

  rebind(handle: string, binding: Omit<ElectronCredentialBinding, "profileId">) {
    const stored = this.document.credentials[handle];
    if (!stored) {
      const session = this.sessionCredentials.get(handle);
      if (session) {
        if (session.origin !== canonicalOrigin(binding.origin)) {
          throw new Error("Credential binding does not match the runner origin.");
        }
        this.sessionCredentials.set(handle, {
          ...session,
          runnerInstanceId: binding.runnerInstanceId,
        });
        return;
      }
      throw new Error("Credential is no longer available.");
    }
    if (stored.origin !== canonicalOrigin(binding.origin)) {
      throw new Error("Credential binding does not match the runner origin.");
    }
    this.document.credentials[handle] = {
      ...stored,
      runnerInstanceId: binding.runnerInstanceId,
    };
    this.persist();
  }

  clear(handle: string) {
    this.sessionCredentials.delete(handle);
    if (!this.document.credentials[handle]) return;
    delete this.document.credentials[handle];
    this.persist();
  }

  clearForProfile(profileId: string) {
    let changed = false;
    for (const [handle, credential] of Object.entries(this.document.credentials)) {
      if (credential.profileId === profileId) {
        delete this.document.credentials[handle];
        changed = true;
      }
    }
    for (const [handle, credential] of this.sessionCredentials) {
      if (credential.profileId === profileId) {
        this.sessionCredentials.delete(handle);
      }
    }
    if (changed) this.persist();
  }
}
