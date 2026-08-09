// Pure helpers for sidebar activity classification. No React imports.
// Used by useHomeViewModel to build the Active tab dataset.

import { isTerminalRunStatus, normalizeRunStatus } from "@/lib/run-status";
import { isWorkerActiveStatus } from "@/lib/conversation-workers";
import { isRunUnread, resolveRunLatestUnreadTimestamp } from "@/lib/conversation-state";
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
  lastActivityAt?: string | null;
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

/**
 * Per-run rollups computed in ONE pass over each global collection.
 *
 * Without this, classifying N runs cost N full scans of every message, queued
 * message, worker and agent in the app — and the sidebar did that three times
 * over on every SSE frame, allocating two `Date` objects per message compared.
 * With ~40 runs and a few thousand accumulated messages that is hundreds of
 * thousands of iterations per frame, which is what made the sidebar the single
 * most expensive thing on the client's main thread while sessions streamed.
 *
 * Build once with `buildSidebarActivityIndex`, reuse for every run.
 */
export interface SidebarActivityIndex {
  latestMessageAtByRunId: Map<string, string>;
  latestUserInputAtByRunId: Map<string, string>;
  workersByRunId: Map<string, WorkerInput[]>;
  agentsByWorkerId: Map<string, AgentInput>;
}

export function buildSidebarActivityIndex(args: {
  messages: MessageInput[];
  queuedMessages: QueuedMessageInput[];
  workers: WorkerInput[];
  agents: AgentInput[];
}): SidebarActivityIndex {
  const latestMessageAtByRunId = new Map<string, string>();
  const latestUserInputAtByRunId = new Map<string, string>();
  const workersByRunId = new Map<string, WorkerInput[]>();
  const agentsByWorkerId = new Map<string, AgentInput>();

  const keepLater = (map: Map<string, string>, runId: string, value: string | null | undefined) => {
    if (!value) return;
    const existing = map.get(runId);
    if (!existing || parseTimestampMs(value) > parseTimestampMs(existing)) {
      map.set(runId, value);
    }
  };

  for (const message of args.messages) {
    keepLater(latestMessageAtByRunId, message.runId, message.createdAt);
    if (isUserInputMessage(message)) {
      keepLater(latestUserInputAtByRunId, message.runId, message.createdAt);
    }
  }

  for (const queued of args.queuedMessages) {
    keepLater(
      latestUserInputAtByRunId,
      queued.runId,
      queued.deliveredAt ?? queued.updatedAt ?? queued.createdAt,
    );
  }

  for (const worker of args.workers) {
    const bucket = workersByRunId.get(worker.runId);
    if (bucket) {
      bucket.push(worker);
    } else {
      workersByRunId.set(worker.runId, [worker]);
    }
  }

  for (const agent of args.agents) {
    agentsByWorkerId.set(agent.name, agent);
  }

  return { latestMessageAtByRunId, latestUserInputAtByRunId, workersByRunId, agentsByWorkerId };
}

function indexFromArgs(args: {
  messages: MessageInput[];
  queuedMessages: QueuedMessageInput[];
  workers: WorkerInput[];
  agents: AgentInput[];
}) {
  return buildSidebarActivityIndex(args);
}

/**
 * Indexed twin of `getRunLatestUnreadTimestamp` from `@/lib/conversation-state`.
 * Same status rules (shared implementation), no per-run message scan.
 */
export function getIndexedRunLatestUnreadTimestamp(
  run: RunInput,
  index: SidebarActivityIndex,
): string | null {
  return resolveRunLatestUnreadTimestamp(run, index.latestMessageAtByRunId.get(run.id) ?? null);
}

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

// recentActivityAt: max of eligible user-input and worker-output signals
export function getSidebarRunLastActivityAt(args: SidebarRunActivityArgs): string | null {
  return getIndexedSidebarRunLastActivityAt(args, indexFromArgs(args));
}

function getIndexedSidebarRunLastActivityAt(
  args: Pick<SidebarRunActivityArgs, "run" | "workerOutputObservedAtByRunId">,
  index: SidebarActivityIndex,
): string | null {
  const userInputAt = index.latestUserInputAtByRunId.get(args.run.id) ?? null;
  const workerOutputAt = args.workerOutputObservedAtByRunId[args.run.id] ?? null;
  return maxTimestamp(userInputAt, workerOutputAt);
}

function getIndexedWorkingActivityAt(run: RunInput, index: SidebarActivityIndex): string | null {
  const runWorkers = index.workersByRunId.get(run.id) ?? [];
  const timestamps: (string | null | undefined)[] = [run.updatedAt];

  for (const worker of runWorkers) {
    if (isWorkerActiveStatus(worker.status)) {
      timestamps.push(worker.updatedAt);
    }
    const agent = index.agentsByWorkerId.get(worker.id);
    if (agent && isWorkerActiveStatus(agent.state)) {
      timestamps.push(agent.updatedAt);
    }
  }

  timestamps.push(run.createdAt);
  return maxTimestamp(...timestamps);
}

export function isSidebarRunCurrentlyWorking(
  args: Pick<SidebarRunActivityArgs, "run" | "workers" | "agents">,
): boolean {
  return isIndexedSidebarRunCurrentlyWorking(args.run, buildSidebarActivityIndex({
    messages: [],
    queuedMessages: [],
    workers: args.workers,
    agents: args.agents,
  }));
}

function isIndexedSidebarRunCurrentlyWorking(run: RunInput, index: SidebarActivityIndex): boolean {
  // Terminal runs are never "working" — stale worker metadata loses.
  if (isTerminalRunStatus(run.status)) return false;

  const normalizedStatus = normalizeRunStatus(run.status);
  if (normalizedStatus === "needs_recovery") return false;

  if (normalizedStatus !== "running" && normalizedStatus !== "awaiting_user") return false;

  const runWorkers = index.workersByRunId.get(run.id) ?? [];

  for (const worker of runWorkers) {
    if (isWorkerActiveStatus(worker.status)) return true;
    const agent = index.agentsByWorkerId.get(worker.id);
    if (agent && isWorkerActiveStatus(agent.state)) return true;
  }

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
  return classifyIndexedSidebarRun(args, indexFromArgs(args));
}

/**
 * The hot path. `buildActiveConversationGroups` builds the index once and calls
 * this per run, so classification is O(workers in run) instead of O(all
 * messages + all workers + all agents).
 */
export function classifyIndexedSidebarRun(
  args: Pick<SidebarRunActivityArgs, "run" | "readMarkers" | "workerOutputObservedAtByRunId" | "nowMs" | "selectedRunId">,
  index: SidebarActivityIndex,
): RunActiveClassification {
  const { run, readMarkers, nowMs } = args;
  const lastReadAt = readMarkers[run.id] ?? null;
  const normalizedStatus = normalizeRunStatus(run.status);

  const latestUnreadAt = getIndexedRunLatestUnreadTimestamp(run, index);
  const isUnread = isRunUnread({ latestMessageAt: latestUnreadAt, lastReadAt });

  const isWorking = isIndexedSidebarRunCurrentlyWorking(run, index);

  const recentActivityAt = getIndexedSidebarRunLastActivityAt(args, index);
  const allowsRecentActivity = normalizedStatus !== "cancelled" && normalizedStatus !== "canceled";
  const isRecent =
    allowsRecentActivity &&
    recentActivityAt !== null &&
    nowMs - parseTimestampMs(recentActivityAt) <= ACTIVE_SESSION_ACTIVITY_WINDOW_MS;

  const isSelected = args.selectedRunId != null && args.run.id === args.selectedRunId;
  const isActive = isUnread || isWorking || isRecent || isSelected;

  let activeSortAt: string | null = recentActivityAt;
  if (isUnread && latestUnreadAt) {
    activeSortAt = maxTimestamp(activeSortAt, latestUnreadAt);
  }
  if (isWorking) {
    activeSortAt = maxTimestamp(activeSortAt, getIndexedWorkingActivityAt(run, index));
  }
  // Worker output is only observed live (see SidebarWorkerActivityManager), so a
  // run whose last turn finished before this page load has no in-memory signal.
  // The persisted activity stamp covers that gap; creation date is the last resort.
  if (!activeSortAt) activeSortAt = run.lastActivityAt ?? run.createdAt;

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

  // One pass over the global collections, reused for every run below. This
  // replaces N full scans of messages/queued/workers/agents per frame.
  const index = buildSidebarActivityIndex({ messages, queuedMessages, workers, agents });

  for (const group of groups) {
    const activeRuns: Array<SidebarRun & { activeSortAt: string | null }> = [];
    let groupLatestMs = 0;

    for (const run of group.runs) {
      const result = classifyIndexedSidebarRun({
        run: {
          id: run.id,
          status: run.status,
          createdAt: run.createdAt,
          updatedAt: (run as SidebarRun & { updatedAt?: string | null }).updatedAt ?? null,
          lastActivityAt: run.lastActivityAt ?? null,
        },
        readMarkers,
        workerOutputObservedAtByRunId,
        nowMs,
        selectedRunId,
      }, index);

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
