import type { AgentRecord } from "@/server/bridge-client";
import { normalizeAgentRecord } from "@/server/bridge-client";
import { formatErrorMessage } from "@/server/runs/failures";
import { parseWorkerOutputEntries } from "@/server/workers/snapshots";

type PersistedWorkerRecord = {
  id: string;
  runId: string;
  type: string;
  status: string;
  cwd: string;
  outputLog: string;
  outputEntriesJson: string;
  currentText: string;
  lastText: string;
  bridgeSessionId: string | null;
  bridgeSessionMode: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

type PersistedRunRecord = {
  id: string;
  planId?: string | null;
  mode?: string | null;
  projectPath?: string | null;
  title?: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel: string | null;
  preferredWorkerEffort: string | null;
  allowedWorkerTypes?: string | null;
  specPath?: string | null;
  artifactPlanPath?: string | null;
  plannerArtifactsJson?: string | null;
  parentRunId?: string | null;
  forkedFromMessageId?: string | null;
  status?: string | null;
  failedAt?: Date | string | null;
  lastError: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type LiveWorkerSnapshot = AgentRecord & {
  bridgeLastError: string | null;
  runLastError: string | null;
  outputLog: string;
  displayText: string;
  bridgeMissing: boolean;
  updatedAt?: Date | string | null;
};

function cleanStructuredOutput(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0 ? value : "";
}

function appendLiveText(base: string, liveText: string) {
  if (!base) {
    return liveText;
  }

  return `${base}${base.endsWith("\n") || liveText.startsWith("\n") ? "" : "\n"}${liveText}`;
}

function buildEmptyStopDiagnostic(stopReason: string | null | undefined) {
  const normalizedStopReason = typeof stopReason === "string" ? stopReason.trim() : "";
  if (!normalizedStopReason) {
    return "";
  }

  return `Agent stopped without producing output. Stop reason: ${normalizedStopReason}.`;
}

function buildMissingBridgeEmptyDiagnostic(worker: PersistedWorkerRecord | null) {
  if (!worker) {
    return "";
  }

  const status = worker.status.trim().toLowerCase().split(":")[0]?.trim() ?? "";
  if (status !== "idle") {
    return "";
  }

  if (worker.outputLog.trim() || worker.currentText.trim() || worker.lastText.trim()) {
    return "";
  }

  return "Worker is idle with no recorded output, and the bridge no longer has a live session for it.";
}

export function buildLiveWorkerSnapshot(args: {
  agent?: unknown | null;
  worker?: PersistedWorkerRecord | null;
  run?: PersistedRunRecord | null;
  bridgeError?: unknown;
}): LiveWorkerSnapshot | null {
  const normalizedAgent = args.agent ? normalizeAgentRecord(args.agent) : null;
  const worker = args.worker ?? null;
  const run = args.run ?? null;

  if (!normalizedAgent && !worker) {
    return null;
  }

  const persistedOutputEntries = parseWorkerOutputEntries(worker?.outputEntriesJson);
  const outputLog = worker?.outputLog ?? "";
  const persistedLastText = worker?.lastText ?? "";
  const requestedModel = normalizedAgent?.requestedModel ?? run?.preferredWorkerModel ?? null;
  const requestedEffort = normalizedAgent?.requestedEffort ?? run?.preferredWorkerEffort ?? null;
  const runLastError = run?.lastError ?? null;

  if (normalizedAgent) {
    const structuredOutput = cleanStructuredOutput(normalizedAgent.renderedOutput);
    const liveText = normalizedAgent.currentText.length > 0 ? normalizedAgent.currentText : "";
    const outputEntries = normalizedAgent.outputEntries?.length ? normalizedAgent.outputEntries : persistedOutputEntries;
    const emptyStopDiagnostic = !structuredOutput && !liveText && outputEntries.length === 0 && !outputLog && !normalizedAgent.lastText && !persistedLastText
      ? buildEmptyStopDiagnostic(normalizedAgent.stopReason)
      : "";
    const lastText = normalizedAgent.lastText || persistedLastText || outputLog || emptyStopDiagnostic;
    const displayBase = structuredOutput || outputLog || lastText || "";
    const displayText = liveText && !structuredOutput ? appendLiveText(displayBase, liveText) : displayBase;

    return {
      ...normalizedAgent,
      type: normalizedAgent.type || worker?.type || "",
      cwd: normalizedAgent.cwd || worker?.cwd || "",
      sessionId: normalizedAgent.sessionId ?? worker?.bridgeSessionId ?? null,
      sessionMode: normalizedAgent.sessionMode ?? worker?.bridgeSessionMode ?? null,
      requestedModel,
      effectiveModel: normalizedAgent.effectiveModel ?? null,
      requestedEffort,
      effectiveEffort: normalizedAgent.effectiveEffort ?? null,
      outputEntries,
      lastText,
      bridgeLastError: normalizedAgent.lastError ?? null,
      runLastError,
      lastError: normalizedAgent.lastError ?? runLastError,
      outputLog,
      displayText,
      bridgeMissing: false,
      updatedAt: worker?.updatedAt ?? null,
    };
  }

  const bridgeLastError = args.bridgeError ? formatErrorMessage(args.bridgeError) : null;
  const missingBridgeDiagnostic = persistedOutputEntries.length === 0
    ? buildMissingBridgeEmptyDiagnostic(worker)
    : "";
  const lastText = persistedLastText || outputLog || missingBridgeDiagnostic;
  const displayText = outputLog || missingBridgeDiagnostic;

  return {
    name: worker?.id ?? "",
    type: worker?.type ?? "",
    cwd: worker?.cwd ?? "",
    state: worker?.status || "starting",
    sessionId: worker?.bridgeSessionId ?? null,
    requestedModel,
    effectiveModel: null,
    requestedEffort,
    effectiveEffort: null,
    sessionMode: worker?.bridgeSessionMode ?? null,
    lastError: runLastError,
    bridgeLastError,
    runLastError,
    outputEntries: persistedOutputEntries,
    outputLog,
    displayText,
    renderedOutput: null,
    currentText: worker?.currentText ?? "",
    lastText,
    stderrBuffer: [],
    pendingPermissions: [],
    stopReason: null,
    bridgeMissing: true,
    updatedAt: worker?.updatedAt ?? null,
  };
}

export function buildLiveWorkerSnapshots(args: {
  agents?: unknown[];
  workers?: PersistedWorkerRecord[];
  runs?: PersistedRunRecord[];
  bridgeError?: unknown;
}) {
  const workers = args.workers ?? [];
  const runsById = new Map((args.runs ?? []).map((run) => [run.id, run]));
  const workersById = new Map(workers.map((worker) => [worker.id, worker]));
  const snapshots: LiveWorkerSnapshot[] = [];
  const seenWorkerIds = new Set<string>();

  for (const rawAgent of args.agents ?? []) {
    const normalizedAgent = normalizeAgentRecord(rawAgent);
    if (!normalizedAgent.name) {
      continue;
    }

    const snapshot = buildLiveWorkerSnapshot({
      agent: normalizedAgent,
      worker: workersById.get(normalizedAgent.name) ?? null,
      run: workersById.get(normalizedAgent.name) ? runsById.get(workersById.get(normalizedAgent.name)!.runId) ?? null : null,
    });

    if (snapshot) {
      snapshots.push(snapshot);
      seenWorkerIds.add(snapshot.name);
    }
  }

  for (const worker of workers) {
    if (seenWorkerIds.has(worker.id)) {
      continue;
    }

    const snapshot = buildLiveWorkerSnapshot({
      worker,
      run: runsById.get(worker.runId) ?? null,
      bridgeError: args.bridgeError,
    });

    if (snapshot) {
      snapshots.push(snapshot);
    }
  }

  return snapshots;
}
