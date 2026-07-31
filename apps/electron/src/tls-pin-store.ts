import fs from "node:fs";
import path from "node:path";

type PinDocument = {
  schemaVersion: 1;
  pins: Record<string, { origin: string; spkiSha256: string; confirmedAt: string }>;
};

function canonicalOrigin(value: string) {
  const url = new URL(value);
  if (url.origin !== value || url.protocol !== "https:") {
    throw new TypeError("TLS pins require an exact HTTPS origin.");
  }
  return url.origin;
}

function normalizeFingerprint(value: string) {
  const trimmed = value.trim();
  if (!/^sha256\/[a-z0-9+/]{43}=$/i.test(trimmed)) {
    throw new TypeError("SPKI fingerprint must use sha256/base64 form.");
  }
  return `sha256/${trimmed.slice(trimmed.indexOf("/") + 1)}`;
}

export class ElectronTlsPinStore {
  private document: PinDocument = { schemaVersion: 1, pins: {} };

  constructor(private readonly filePath: string) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as PinDocument;
      if (parsed.schemaVersion === 1 && parsed.pins) this.document = parsed;
    } catch {
      // A missing or corrupt pin file starts empty; trust is never widened.
    }
  }

  get(profileId: string) {
    return this.document.pins[profileId] ?? null;
  }

  confirm(profileId: string, origin: string, spkiSha256: string) {
    const next = {
      origin: canonicalOrigin(origin),
      spkiSha256: normalizeFingerprint(spkiSha256),
      confirmedAt: new Date().toISOString(),
    };
    this.document.pins[profileId] = next;
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(this.document)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    fs.renameSync(temporaryPath, this.filePath);
    return next;
  }

  clear(profileId: string) {
    if (!this.document.pins[profileId]) return;
    delete this.document.pins[profileId];
    fs.writeFileSync(this.filePath, `${JSON.stringify(this.document)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  }
}
