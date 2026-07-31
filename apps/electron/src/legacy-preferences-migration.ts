import fs from "node:fs/promises";
import path from "node:path";

export const LEGACY_PREFERENCE_EXPORT_FILE = "interface-origin-migration.v1.json";

export type LegacyPreferenceExport = {
  schemaVersion: 1;
  exportedAt: string;
  sourceOrigin: string;
  entries: Record<string, string>;
};

const SENSITIVE_KEY = /(?:auth|bearer|credential|password|pkce|secret|session|ticket|token)/i;

export function isExportableLegacyPreferenceKey(key: string) {
  return (
    (key.startsWith("omni-") || key.startsWith("omni."))
    && !SENSITIVE_KEY.test(key)
  );
}

function validateLegacyPreferenceExport(value: unknown): LegacyPreferenceExport {
  if (!value || typeof value !== "object") {
    throw new Error("Legacy preference export must be an object.");
  }
  const candidate = value as Partial<LegacyPreferenceExport>;
  if (candidate.schemaVersion !== 1) {
    throw new Error("Legacy preference export has an unsupported schema version.");
  }
  if (typeof candidate.exportedAt !== "string" || !candidate.exportedAt) {
    throw new Error("Legacy preference export is missing exportedAt.");
  }
  if (typeof candidate.sourceOrigin !== "string") {
    throw new Error("Legacy preference export is missing sourceOrigin.");
  }
  const sourceUrl = new URL(candidate.sourceOrigin);
  if (
    sourceUrl.origin !== candidate.sourceOrigin
    || (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:")
  ) {
    throw new Error("Legacy preference export sourceOrigin must be an HTTP origin.");
  }
  if (!candidate.entries || typeof candidate.entries !== "object") {
    throw new Error("Legacy preference export entries must be an object.");
  }
  const entries: Record<string, string> = {};
  for (const [key, entryValue] of Object.entries(candidate.entries)) {
    if (!isExportableLegacyPreferenceKey(key) || typeof entryValue !== "string") {
      throw new Error(`Legacy preference export contains an invalid key: ${key}.`);
    }
    entries[key] = entryValue;
  }
  return {
    schemaVersion: 1,
    exportedAt: candidate.exportedAt,
    sourceOrigin: candidate.sourceOrigin,
    entries,
  };
}

export function legacyPreferenceExportPath(userDataPath: string) {
  return path.join(userDataPath, LEGACY_PREFERENCE_EXPORT_FILE);
}

export async function readLegacyPreferenceExport(userDataPath: string) {
  const exportPath = legacyPreferenceExportPath(userDataPath);
  const source = await fs.readFile(exportPath, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Legacy preference export is not valid JSON.");
  }
  return validateLegacyPreferenceExport(parsed);
}

export async function writeLegacyPreferenceExport({
  userDataPath,
  payload,
}: {
  userDataPath: string;
  payload: LegacyPreferenceExport;
}) {
  const validated = validateLegacyPreferenceExport(payload);
  const exportPath = legacyPreferenceExportPath(userDataPath);
  try {
    const current = await readLegacyPreferenceExport(userDataPath);
    if (
      current.sourceOrigin === validated.sourceOrigin
      && JSON.stringify(current.entries) === JSON.stringify(validated.entries)
    ) {
      return exportPath;
    }
  } catch {
    // A missing or corrupt export is replaced atomically below.
  }

  await fs.mkdir(userDataPath, { recursive: true });
  const temporaryPath = `${exportPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.writeFile(
      temporaryPath,
      `${JSON.stringify(validated, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await fs.rename(temporaryPath, exportPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
  return exportPath;
}

export function legacyPreferenceSnapshotScript() {
  return `(() => {
    const sensitive = /(?:auth|bearer|credential|password|pkce|secret|session|ticket|token)/i;
    const entries = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || sensitive.test(key) || !(key.startsWith("omni-") || key.startsWith("omni."))) continue;
      const value = window.localStorage.getItem(key);
      if (value !== null) entries[key] = value;
    }
    return entries;
  })()`;
}

export async function importLegacyPreferenceExport({
  userDataPath,
  readCurrentProfiles,
  writeProfiles,
  removeProfiles,
}: {
  userDataPath: string;
  readCurrentProfiles(): string | null;
  writeProfiles(value: string): void;
  removeProfiles(): void;
}) {
  const markerPath = path.join(userDataPath, "interface-origin-migration.v1.imported");
  try {
    await fs.access(markerPath);
    return { status: "already_imported" as const };
  } catch {
    // Continue with the one-time import.
  }

  let legacy: LegacyPreferenceExport;
  try {
    legacy = await readLegacyPreferenceExport(userDataPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { status: "no_export" as const };
    }
    throw error;
  }
  const previous = readCurrentProfiles();
  if (previous) {
    await fs.writeFile(markerPath, "existing-profile-store\n", { mode: 0o600 });
    return { status: "existing_profiles" as const };
  }

  const profileId = "electron-legacy-local";
  const document = {
    schemaVersion: 1,
    activeRunnerId: profileId,
    profiles: [{
      id: profileId,
      runnerInstanceId: null,
      label: "Local runner",
      baseUrl: legacy.sourceOrigin,
      authTransport: "bearer",
      credentialRef: null,
      schemaVersion: 1,
      createdAt: legacy.exportedAt,
      lastConnectedAt: null,
      isSameOrigin: false,
    }],
    scopedState: {
      [profileId]: {
        preferences: legacy.entries,
        drafts: {},
        cursors: {},
      },
    },
  };

  try {
    writeProfiles(JSON.stringify(document));
    await fs.writeFile(markerPath, "imported\n", { mode: 0o600 });
    return { status: "imported" as const, profileId };
  } catch (error) {
    if (previous === null) removeProfiles();
    else writeProfiles(previous);
    throw error;
  }
}
