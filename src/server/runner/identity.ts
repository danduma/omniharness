import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import {
  RUNNER_API_REVISION,
  RUNNER_CAPABILITIES,
  RUNNER_PACKAGE_VERSION,
} from "@/shared/api-revision";
import { getEventStreamEpoch } from "@/server/events/named-events";
import type {
  RunnerBootstrapIdentity,
  RunnerReadinessState,
} from "@/shared/bootstrap";

const RUNNER_IDENTITY_SETTING_KEY = "__runner_identity_v1";
const DEFAULT_RUNNER_NAME = "OmniHarness Runner";

export type StoredRunnerIdentity = {
  runnerInstanceId: string;
  name: string;
};

export interface RunnerIdentityStore {
  read(): Promise<string | null>;
  writeIfAbsent(value: string): Promise<void>;
  write(value: string): Promise<void>;
}

type ReadinessSnapshot = {
  status: RunnerReadinessState;
  bridgeStatus: string;
};

type ReadinessSource = {
  getSnapshot(): ReadinessSnapshot;
};

let readinessSource: ReadinessSource | null = null;

const databaseIdentityStore: RunnerIdentityStore = {
  async read() {
    const row = await db.select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, RUNNER_IDENTITY_SETTING_KEY))
      .get();
    return row?.value ?? null;
  },
  async writeIfAbsent(value) {
    const now = new Date();
    await db.insert(settings).values({
      key: RUNNER_IDENTITY_SETTING_KEY,
      value,
      updatedAt: now,
    }).onConflictDoNothing();
  },
  async write(value) {
    const now = new Date();
    await db.insert(settings).values({
      key: RUNNER_IDENTITY_SETTING_KEY,
      value,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: now },
    });
  },
};

function parseStoredIdentity(value: string | null): StoredRunnerIdentity | null {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as Partial<StoredRunnerIdentity>;
    if (
      typeof parsed.runnerInstanceId !== "string"
      || !parsed.runnerInstanceId.trim()
      || typeof parsed.name !== "string"
      || !parsed.name.trim()
    ) {
      return null;
    }
    return {
      runnerInstanceId: parsed.runnerInstanceId,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export async function ensureRunnerIdentity(
  store: RunnerIdentityStore = databaseIdentityStore,
): Promise<StoredRunnerIdentity> {
  const existing = parseStoredIdentity(await store.read());
  if (existing) {
    return existing;
  }

  const candidate: StoredRunnerIdentity = {
    runnerInstanceId: randomUUID(),
    name: DEFAULT_RUNNER_NAME,
  };
  await store.writeIfAbsent(JSON.stringify(candidate));
  return parseStoredIdentity(await store.read()) ?? candidate;
}

function normalizeRunnerName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    throw new TypeError("Runner name is required.");
  }
  if (normalized.length > 80) {
    throw new TypeError("Runner name must be 80 characters or fewer.");
  }
  if (/[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new TypeError("Runner name cannot contain control characters.");
  }
  return normalized;
}

export async function renameRunner(
  name: string,
  store: RunnerIdentityStore = databaseIdentityStore,
) {
  const current = await ensureRunnerIdentity(store);
  const next = {
    ...current,
    name: normalizeRunnerName(name),
  };
  await store.write(JSON.stringify(next));
  return next;
}

export async function rekeyRunnerIdentity(
  store: RunnerIdentityStore = databaseIdentityStore,
) {
  const current = await ensureRunnerIdentity(store);
  const next = {
    runnerInstanceId: randomUUID(),
    name: current.name,
  };
  await store.write(JSON.stringify(next));
  return next;
}

export function configureRunnerReadinessSource(source: ReadinessSource | null) {
  readinessSource = source;
}

export async function buildRunnerBootstrapIdentity(): Promise<RunnerBootstrapIdentity> {
  const identity = await ensureRunnerIdentity();
  const readiness = readinessSource?.getSnapshot() ?? {
    status: "starting",
    bridgeStatus: "unavailable",
  };
  return {
    ...identity,
    version: RUNNER_PACKAGE_VERSION,
    apiRevision: { ...RUNNER_API_REVISION },
    capabilities: [...RUNNER_CAPABILITIES],
    bridgeState: readiness.bridgeStatus === "ready" ? "ready" : "degraded",
    readinessState: readiness.status,
    streamEpoch: getEventStreamEpoch(),
  };
}
