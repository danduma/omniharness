// Pure helpers for sidebar activity classification. No React imports.
// Used by useHomeViewModel to build the Active tab dataset.

import { isTerminalRunStatus, normalizeRunStatus } from "@/lib/run-status";
import { isWorkerActiveStatus } from "@/lib/conversation-workers";
import { getRunLatestUnreadTimestamp, isRunUnread } from "@/lib/conversation-state";
import type { SidebarGroup, SidebarRun } from "./types";

export const ACTIVE_SESSION_ACTIVITY_WINDOW_MS = 20 * 60 * 1000;

function parseTimestampMs(value: string | null | undefined): number {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

function laterOf(a: string | null | undefined, b: string | null | undefined): string | null {
  const aMs = parseTimestampMs(a);
  const bMs = parseTimestampMs(b);
  if (!a && !b) return null;
  return aMs >= bMs ? (a ?? null) : (b ?? null);
}

function maxTimestamp(...values: (string | null | undefined)[]): string | null {
  return values.reduce<string | null>((acc, v) => laterOf(acc, v), null);
}

// User-authored input rows only — excludes supervisor, internal, checkpoint, intervention
function isUserInputMessage(message: { role: string; kind?: string | null }): boolean {
  if ((message.role ?? "").toLowerCase() !== "user") return false;
  const kind = (message.kind ?? "").toLowerCase();
  return kind !== "checkpoint" && kind !== "internal" && kind !== "intervention";
}

type RunInput = {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
};

type WorkerInput = {
  id: string;
  runId: string;
  status: string;
  updatedAt?: string;
};

type AgentInput = {
  name: string; // workerId
  state: string;
  updatedAt?: string;
  lastText?: string;
  currentText?: string;
  displayText?: string;
};

type MessageInput = {
  runId: string;
  role: string;
  kind?: string | null;
  createdAt: string;
};

type QueuedMessageInput = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
};

export interface SidebarRunActivityArgs {
  run: RunInput;
  messages: MessageInput[];
  readMarkers: Record<string, string>;
  workers: WorkerInput[];
  agents: AgentInput[];
  queuedMessages: QueuedMessageInput[];
  workerOutputObservedAtByRunId: Record<string, string>;
  nowMs: number;
  selectedRunId?: string | null;
}

function getLatestUserInputAt(
  runId: string,
  messages: MessageInput[],
  queuedMessages: QueuedMessageInput[],
): string | null {
  let latest: string | null = null;

  for (const msg of messages) {
    if (msg.runId !== runId || !isUserInputMessage(msg)) continue;
    if (parseTimestampMs(msg.createdAt) > parseTimestampMs(latest)) {
      latest = msg.createdAt;
    }
  }

  for (const qm of queuedMessages) {
    if (qm.runId !== runId) continue;
    const ts = qm.deliveredAt ?? qm.updatedAt ?? qm.createdAt;
    if (parseTimestampMs(ts) > parseTimestampMs(latest)) {
      latest = ts;
    }
  }

  return latest;
}

// recentActivityAt: max of eligible user-input and worker-output signals
export function getSidebarRunLastActivityAt(args: SidebarRunActivityArgs): string | null {
  const userInputAt = getLatestUserInputAt(args.run.id, args.messages, args.queuedMessages);
  const workerOutputAt = args.workerOutputObservedAtByRunId[args.run.id] ?? null;
  return maxTimestamp(userInputAt, workerOutputAt);
}

function getWorkingActivityAt(
  args: Pick<SidebarRunActivityArgs, "run" | "workers" | "agents">,
): string | null {
  const { run, workers, agents } = args;
  const runWorkers = workers.filter((w) => w.runId === run.id);
  const activeWorkers = runWorkers.filter((w) => isWorkerActiveStatus(w.status));
  const runWorkerIds = new Set(runWorkers.map((w) => w.id));
  const activeAgents = agents.filter((a) => runWorkerIds.has(a.name) && isWorkerActiveStatus(a.state));

  return maxTimestamp(
    run.updatedAt,
    ...activeWorkers.map((w) => w.updatedAt),
    ...activeAgents.map((a) => a.updatedAt),
    run.createdAt,
  );
}

export function isSidebarRunCurrentlyWorking(
  args: Pick<SidebarRunActivityArgs, "run" | "workers" | "agents">,
): boolean {
  const { run, workers, agents } = args;

  // Terminal runs are never "working" — stale worker metadata loses.
  if (isTerminalRunStatus(run.status)) return false;

  const normalizedStatus = normalizeRunStatus(run.status);
  if (normalizedStatus === "needs_recovery") return false;

  if (normalizedStatus !== "running" && normalizedStatus !== "awaiting_user") return false;

  const runWorkers = workers.filter((w) => w.runId === run.id);

  if (runWorkers.some((w) => isWorkerActiveStatus(w.status))) return true;

  const runWorkerIds = new Set(runWorkers.map((w) => w.id));
  if (agents.some((a) => runWorkerIds.has(a.name) && isWorkerActiveStatus(a.state))) return true;

  // Run is "running" with no active workers/agents yet — still counts.
  return normalizedStatus === "running";
}

export interface RunActiveClassification {
  isActive: boolean;
  isUnread: boolean;
  isWorking: boolean;
  isRecent: boolean;
  recentActivityAt: string | null;
  activeSortAt: string | null;
}

export function classifySidebarRun(args: SidebarRunActivityArgs): RunActiveClassification {
  const { run, readMarkers, nowMs } = args;
  const lastReadAt = readMarkers[run.id] ?? null;

  const latestUnreadAt = getRunLatestUnreadTimestamp(run, args.messages);
  const isUnread = isRunUnread({ latestMessageAt: latestUnreadAt, lastReadAt });

  const isWorking = isSidebarRunCurrentlyWorking(args);

  const recentActivityAt = getSidebarRunLastActivityAt(args);
  const isRecent =
    recentActivityAt !== null &&
    nowMs - parseTimestampMs(recentActivityAt) <= ACTIVE_SESSION_ACTIVITY_WINDOW_MS;

  const isSelected = args.selectedRunId != null && args.run.id === args.selectedRunId;
  const isActive = isUnread || isWorking || isRecent || isSelected;

  let activeSortAt: string | null = recentActivityAt;
  if (isUnread && latestUnreadAt) {
    activeSortAt = maxTimestamp(activeSortAt, latestUnreadAt);
  }
  if (isWorking) {
    activeSortAt = maxTimestamp(activeSortAt, getWorkingActivityAt(args));
  }
  if (!activeSortAt) activeSortAt = run.createdAt;

  return { isActive, isUnread, isWorking, isRecent, recentActivityAt, activeSortAt };
}

export function compareActiveSidebarRunsDesc(
  a: { activeSortAt: string | null; createdAt: string; id: string },
  b: { activeSortAt: string | null; createdAt: string; id: string },
): number {
  const diff = parseTimestampMs(b.activeSortAt) - parseTimestampMs(a.activeSortAt);
  if (diff !== 0) return diff;
  const createdDiff = parseTimestampMs(b.createdAt) - parseTimestampMs(a.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export interface BuildActiveGroupsArgs {
  groups: SidebarGroup[];
  messages: MessageInput[];
  readMarkers: Record<string, string>;
  workers: WorkerInput[];
  agents: AgentInput[];
  queuedMessages: QueuedMessageInput[];
  workerOutputObservedAtByRunId: Record<string, string>;
  nowMs: number;
  selectedRunId?: string | null;
}

export function buildActiveConversationGroups(args: BuildActiveGroupsArgs): SidebarGroup[] {
  const { groups, messages, readMarkers, workers, agents, queuedMessages, workerOutputObservedAtByRunId, nowMs, selectedRunId } = args;

  const activeGroups: Array<{ group: SidebarGroup; latestActivityMs: number }> = [];

  for (const group of groups) {
    const activeRuns: Array<SidebarRun & { activeSortAt: string | null }> = [];
    let groupLatestMs = 0;

    for (const run of group.runs) {
      const result = classifySidebarRun({
        run: {
          id: run.id,
          status: run.status,
          createdAt: run.createdAt,
          updatedAt: (run as SidebarRun & { updatedAt?: string | null }).updatedAt ?? null,
        },
        messages,
        readMarkers,
        workers,
        agents,
        queuedMessages,
        workerOutputObservedAtByRunId,
        nowMs,
        selectedRunId,
      });

      if (!result.isActive) continue;

      activeRuns.push({ ...run, activeSortAt: result.activeSortAt });
      const ms = parseTimestampMs(result.activeSortAt);
      if (ms > groupLatestMs) groupLatestMs = ms;
    }

    if (activeRuns.length === 0) continue;

    activeRuns.sort(compareActiveSidebarRunsDesc);

    activeGroups.push({
      group: { path: group.path, name: group.name, runs: activeRuns },
      latestActivityMs: groupLatestMs,
    });
  }

  activeGroups.sort((a, b) => {
    const diff = b.latestActivityMs - a.latestActivityMs;
    if (diff !== 0) return diff;
    if (a.group.name < b.group.name) return -1;
    if (a.group.name > b.group.name) return 1;
    if (a.group.path < b.group.path) return -1;
    if (a.group.path > b.group.path) return 1;
    return 0;
  });

  return activeGroups.map((entry) => entry.group);
}

// Apply search to the active groups.
// If the query matches the project name, all active sessions in that project remain visible.
// Otherwise filter active sessions whose title or path matches the query.
export function filterActiveConversationGroups(
  activeGroups: SidebarGroup[],
  searchQuery: string,
): SidebarGroup[] {
  if (!searchQuery) return activeGroups;
  const q = searchQuery.toLowerCase();

  return activeGroups
    .map((group) => {
      if (group.name.toLowerCase().includes(q)) {
        // Project name matches — show all active sessions in this project.
        return group;
      }
      // Otherwise filter sessions by title or path.
      const runs = group.runs.filter(
        (run) => run.title.toLowerCase().includes(q) || run.path.toLowerCase().includes(q),
      );
      return { ...group, runs };
    })
    .filter((group) => group.runs.length > 0);
}
