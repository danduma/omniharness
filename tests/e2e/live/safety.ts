import fs from "node:fs";
import path from "node:path";
import {
  LIVE_JOURNEY_SCHEMA_VERSION,
  type LiveJourneyManifest,
  type LiveJourneyMarker,
  type LiveJourneyOwnedRun,
} from "./types";

export const LIVE_JOURNEY_MARKER_FILE = ".omniharness-live-journey.json";

const SAFE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const SECRET_PATTERN = /(?:bearer\s+\S+|password|api[_-]?key|access[_-]?token|refresh[_-]?token|session[_-]?cookie|oauth[_-]?url)/i;

function isWithin(candidate: string, root: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function writeJsonDurably(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  let fileDescriptor: number | null = null;
  try {
    fileDescriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(fileDescriptor, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    fs.fsyncSync(fileDescriptor);
    fs.closeSync(fileDescriptor);
    fileDescriptor = null;
    fs.renameSync(temporaryPath, filePath);
    const directoryDescriptor = fs.openSync(directory, "r");
    try {
      fs.fsyncSync(directoryDescriptor);
    } finally {
      fs.closeSync(directoryDescriptor);
    }
  } finally {
    if (fileDescriptor !== null) {
      fs.closeSync(fileDescriptor);
    }
    fs.rmSync(temporaryPath, { force: true });
  }
}

export function assertLoopbackUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Live journey target must be a valid loopback URL.");
  }
  const hostname = parsed.hostname.toLowerCase();
  const isLoopback = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]";
  if (!isLoopback || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
    throw new Error("Live journey target must use HTTP on a loopback host.");
  }
  return parsed;
}

export function assertLiveJourneyOptIn(env: Record<string, string | undefined>): void {
  if (env.OMNIHARNESS_LIVE_E2E !== "1") {
    throw new Error("Set OMNIHARNESS_LIVE_E2E=1 to authorize a real-agent journey.");
  }
  if (!env.OMNIHARNESS_LIVE_E2E_PASSWORD?.trim()
    && env.OMNIHARNESS_LIVE_E2E_AUTHENTICATED !== "1") {
    throw new Error("Provide a runtime password or an explicitly authenticated browser session.");
  }
}

export function assertOwnedTempProject(args: {
  projectPath: string;
  repoRoot: string;
  tempRoot: string;
  registeredProjectPaths?: string[];
}): string {
  const projectPath = fs.realpathSync(args.projectPath);
  const repoRoot = fs.realpathSync(args.repoRoot);
  const tempRoot = fs.realpathSync(args.tempRoot);
  if (!isWithin(projectPath, tempRoot)) {
    throw new Error("Live journey project must resolve inside the temporary root; symlink escapes are refused.");
  }
  if (isWithin(projectPath, repoRoot) || isWithin(repoRoot, projectPath)) {
    throw new Error("Live journey project must be outside the OmniHarness repository.");
  }
  for (const registeredPath of args.registeredProjectPaths ?? []) {
    if (!fs.existsSync(registeredPath)) continue;
    const registeredRealPath = fs.realpathSync(registeredPath);
    if (isWithin(projectPath, registeredRealPath) || isWithin(registeredRealPath, projectPath)) {
      throw new Error("Live journey project must not overlap a registered user project.");
    }
  }
  return projectPath;
}

export function assertManifestSafe(manifest: LiveJourneyManifest): void {
  if (manifest.schemaVersion !== LIVE_JOURNEY_SCHEMA_VERSION) {
    throw new Error("Unsupported live journey manifest schema.");
  }
  if (!SAFE_ID_PATTERN.test(manifest.journeyId)) {
    throw new Error("Live journey manifest contains an unsafe journey id or secret-shaped value.");
  }
  if (!path.isAbsolute(manifest.projectPath)) {
    throw new Error("Live journey project path must be absolute.");
  }
  if (!Number.isFinite(Date.parse(manifest.createdAt))) {
    throw new Error("Live journey manifest createdAt must be an ISO timestamp.");
  }
  const runIds = new Set<string>();
  const labels = new Set<string>();
  for (const run of manifest.runs) {
    if (!SAFE_ID_PATTERN.test(run.id) || !["A", "B", "C"].includes(run.label)) {
      throw new Error("Live journey manifest contains an unsafe run record.");
    }
    if (runIds.has(run.id) || labels.has(run.label)) {
      throw new Error("Live journey manifest contains a duplicate run id or label.");
    }
    if (!Number.isFinite(Date.parse(run.createdAt))) {
      throw new Error("Live journey run createdAt must be an ISO timestamp.");
    }
    runIds.add(run.id);
    labels.add(run.label);
  }
  if (manifest.runs.length > 3 || SECRET_PATTERN.test(JSON.stringify(manifest))) {
    throw new Error("Live journey manifest contains secret-shaped or unsafe data.");
  }
}

export function writeLiveJourneyManifestDurably(
  manifestPath: string,
  manifest: LiveJourneyManifest,
): void {
  assertManifestSafe(manifest);
  writeJsonDurably(manifestPath, manifest);
}

export function readLiveJourneyManifest(manifestPath: string): LiveJourneyManifest {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as LiveJourneyManifest;
  assertManifestSafe(manifest);
  return manifest;
}

export function recordOwnedRunDurably(
  manifestPath: string,
  run: LiveJourneyOwnedRun,
): LiveJourneyManifest {
  const manifest = readLiveJourneyManifest(manifestPath);
  const nextManifest = { ...manifest, runs: [...manifest.runs, run] };
  writeLiveJourneyManifestDurably(manifestPath, nextManifest);
  return nextManifest;
}

export function assertManifestOwnsRun(manifest: LiveJourneyManifest, runId: string): void {
  assertManifestSafe(manifest);
  if (!manifest.runs.some((run) => run.id === runId)) {
    throw new Error(`Run ${runId} is not owned by live journey ${manifest.journeyId}.`);
  }
}

export function assertProjectMarkerMatches(
  projectPath: string,
  manifest: LiveJourneyManifest,
): void {
  assertManifestSafe(manifest);
  const projectRealPath = fs.realpathSync(projectPath);
  const markerPath = path.join(projectRealPath, LIVE_JOURNEY_MARKER_FILE);
  const marker = JSON.parse(fs.readFileSync(markerPath, "utf8")) as LiveJourneyMarker;
  if (marker.schemaVersion !== LIVE_JOURNEY_SCHEMA_VERSION
    || marker.journeyId !== manifest.journeyId
    || marker.projectPath !== manifest.projectPath
    || marker.createdAt !== manifest.createdAt
    || fs.realpathSync(marker.projectPath) !== projectRealPath) {
    throw new Error("Live journey project marker does not match the cleanup manifest.");
  }
}

export function writeLiveJourneyMarkerDurably(markerPath: string, marker: LiveJourneyMarker): void {
  if (marker.schemaVersion !== LIVE_JOURNEY_SCHEMA_VERSION
    || !SAFE_ID_PATTERN.test(marker.journeyId)
    || !path.isAbsolute(marker.projectPath)
    || !Number.isFinite(Date.parse(marker.createdAt))) {
    throw new Error("Live journey marker is invalid.");
  }
  writeJsonDurably(markerPath, marker);
}
