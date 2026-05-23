import type { AgentSnapshot, ExecutionEventRecord, RunRecord } from "@/app/home/types";
import {
  getWorkerRuntimeLabel,
  isWorkerActiveStatus,
  normalizeWorkerStatus,
  type ConversationWorkerRecord,
} from "@/lib/conversation-workers";
import { extractLatestPlainTextTurn } from "@/lib/agent-output";
import { parseExecutionEventDetails, summarizeThought } from "./utils";

export type SupervisorActivityTone = "active" | "muted" | "warning" | "error";

export type SupervisorActivityStatus = {
  label: string;
  detail: string;
  tone: SupervisorActivityTone;
};

export type SupervisorActivityWorker = {
  workerId: string;
  workerType: string | null;
  workerNumber: number | null;
  title: string | null;
  statusKey: string;
  statusParams?: Record<string, string | number>;
  activityKey?: string;
  activityParams?: Record<string, string | number>;
  activityText: string;
  attentionKey?: string;
  attentionParams?: Record<string, string | number>;
  runtimeLabel: string | null;
  tone: SupervisorActivityTone;
  isLive: boolean;
};

export type SupervisorActivityCard = {
  status: SupervisorActivityStatus;
  phaseKey: string;
  phaseParams?: Record<string, string | number>;
  detailText: string;
  workers: SupervisorActivityWorker[];
};

type BuildSupervisorActivityCardInput = {
  selectedRun: RunRecord | null;
  liveExecutionStatus: SupervisorActivityStatus;
  activeWorkers: ConversationWorkerRecord[];
  agents: AgentSnapshot[];
  executionEvents: ExecutionEventRecord[];
  nowMs?: number;
};

type WorkerActivityPayload = Pick<
  SupervisorActivityWorker,
  "activityKey" | "activityParams" | "activityText" | "attentionKey" | "attentionParams" | "tone"
>;

const MEANINGFUL_EVENT_TYPES = new Set([
  "worker_prompted",
  "worker_prompt_failed",
  "worker_prompt_deferred",
  "worker_permission_requested",
  "worker_permission_approved",
  "worker_permission_auto_approved",
  "worker_session_resumed",
  "worker_session_recreated",
  "worker_turn_completed",
  "worker_idle",
  "worker_stuck",
  "worker_error",
  "worker_stopped",
  "worker_spawned",
  "supervisor_turn_ended",
  "supervisor_wait",
  "run_completed",
  "run_failed",
]);

function eventTimeMs(event: Pick<ExecutionEventRecord, "createdAt" | "id">) {
  const time = new Date(event.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function compareNewestEvent(left: ExecutionEventRecord, right: ExecutionEventRecord) {
  const timeDiff = eventTimeMs(right) - eventTimeMs(left);
  return timeDiff || right.id.localeCompare(left.id);
}

function eventSummary(event: ExecutionEventRecord | null | undefined) {
  if (!event) {
    return "";
  }
  const details = parseExecutionEventDetails(event.details);
  const summary = typeof details.summary === "string" ? details.summary.trim() : "";
  const reason = typeof details.reason === "string" ? details.reason.trim() : "";
  const error = typeof details.error === "string" ? details.error.trim() : "";
  return summarizeThought(summary || reason || error);
}

function latestMeaningfulEvent(events: ExecutionEventRecord[], workerId?: string | null) {
  return events
    .filter((event) => (
      MEANINGFUL_EVENT_TYPES.has(event.eventType)
      && (workerId === undefined || event.workerId === workerId)
    ))
    .sort(compareNewestEvent)[0] ?? null;
}

function statusKeyForWorker(status: string) {
  const normalized = normalizeWorkerStatus(status);
  if (normalized === "starting") return "supervisor.activity.worker.status.starting";
  if (normalized === "working") return "supervisor.activity.worker.status.working";
  if (normalized === "idle") return "supervisor.activity.worker.status.idle";
  if (normalized === "stuck") return "supervisor.activity.worker.status.stuck";
  if (normalized === "recovering") return "supervisor.activity.worker.status.recovering";
  return "supervisor.activity.worker.status.generic";
}

function buildWorkerActivityText(args: {
  worker: ConversationWorkerRecord;
  agent: AgentSnapshot | undefined;
  latestEvent: ExecutionEventRecord | null;
}): WorkerActivityPayload {
  const permissions = args.agent?.pendingPermissions?.length ?? 0;
  if (permissions > 0) {
    return {
      activityKey: "supervisor.activity.worker.permission",
      activityParams: { count: permissions },
      activityText: "",
      attentionKey: "supervisor.activity.attention.permission",
      attentionParams: { count: permissions },
      tone: "warning" as const,
    };
  }

  if (normalizeWorkerStatus(args.worker.status) === "stuck" || normalizeWorkerStatus(args.agent?.state) === "stuck") {
    return {
      activityKey: "supervisor.activity.worker.stuck",
      activityText: "",
      attentionKey: "supervisor.activity.attention.stuck",
      tone: "warning" as const,
    };
  }

  // `stopReason` is informational ("end_turn", "max_tokens", "stop_sequence",
  // "tool_use", "refusal", "cancelled", …); only "refusal" indicates an error.
  // Everything else — especially "end_turn" — is a normal completion signal
  // and must NOT trip the error UI. `lastError` and `state === "error"` are
  // the canonical error signals.
  const lastError = args.agent?.lastError?.trim() ?? "";
  const stopReason = args.agent?.stopReason?.trim() ?? "";
  const stopReasonIsError = stopReason === "refusal";
  if (normalizeWorkerStatus(args.agent?.state) === "error" || lastError || stopReasonIsError) {
    const errorText = lastError || (stopReasonIsError ? stopReason : "");
    return {
      activityKey: "supervisor.activity.worker.error",
      activityParams: { error: summarizeThought(errorText || "Worker reported an error.") },
      activityText: "",
      attentionKey: "supervisor.activity.attention.error",
      tone: "error" as const,
    };
  }

  const userFacingText = extractLatestPlainTextTurn({
    outputEntries: args.agent?.outputEntries,
    currentText: args.agent?.currentText,
    lastText: args.agent?.lastText,
  });
  const persistedText = args.agent?.displayText?.trim() || args.agent?.lastText?.trim() || "";
  const latestEventText = eventSummary(args.latestEvent);
  const activityText = summarizeThought(userFacingText || latestEventText || persistedText || "");
  if (activityText) {
    return {
      activityText,
      tone: "active" as const,
    };
  }

  return {
    activityKey: "supervisor.activity.worker.starting",
    activityText: "",
    tone: "muted" as const,
  };
}

function derivePhaseKey(args: {
  selectedRun: RunRecord | null;
  activeWorkers: ConversationWorkerRecord[];
  agents: AgentSnapshot[];
  liveExecutionStatus: SupervisorActivityStatus;
}) {
  const status = normalizeWorkerStatus(args.selectedRun?.status);
  if (status === "awaiting_user") return "supervisor.activity.phase.awaitingUser";
  if (status === "failed") return "supervisor.activity.phase.failed";
  if (status === "needs_recovery" || status === "recovering") return "supervisor.activity.phase.recovering";
  if (status === "done") return "supervisor.activity.phase.completed";
  if (status === "cancelled" || status === "canceled") return "supervisor.activity.phase.stopped";

  const hasPendingPermission = args.agents.some((agent) => (agent.pendingPermissions?.length ?? 0) > 0);
  const hasStuckWorker = args.activeWorkers.some((worker) => {
    const workerStatus = normalizeWorkerStatus(worker.status);
    return workerStatus === "stuck" || workerStatus === "recovering";
  });
  if (hasPendingPermission || hasStuckWorker || args.liveExecutionStatus.tone === "warning") {
    return "supervisor.activity.phase.unblocking";
  }

  if (args.activeWorkers.length > 0) {
    return "supervisor.activity.phase.implementing";
  }
  return "supervisor.activity.phase.supervisorThinking";
}

export function buildSupervisorActivityCard({
  selectedRun,
  liveExecutionStatus,
  activeWorkers,
  agents,
  executionEvents,
  nowMs = Date.now(),
}: BuildSupervisorActivityCardInput): SupervisorActivityCard {
  const agentsByName = new Map(agents.map((agent) => [agent.name, agent]));
  const sortedActiveWorkers = [...activeWorkers]
    .filter((worker) => isWorkerActiveStatus(worker.status))
    .sort((left, right) => {
      const numberDiff = (left.workerNumber ?? Number.MAX_SAFE_INTEGER) - (right.workerNumber ?? Number.MAX_SAFE_INTEGER);
      if (numberDiff) return numberDiff;
      const createdDiff = new Date(left.createdAt ?? 0).getTime() - new Date(right.createdAt ?? 0).getTime();
      return createdDiff || left.id.localeCompare(right.id);
    });
  const phaseKey = derivePhaseKey({
    selectedRun,
    activeWorkers: sortedActiveWorkers,
    agents,
    liveExecutionStatus,
  });
  const latestSupervisorEvent = latestMeaningfulEvent(executionEvents);
  const detailText = summarizeThought(liveExecutionStatus.detail || eventSummary(latestSupervisorEvent));

  return {
    status: liveExecutionStatus,
    phaseKey,
    detailText,
    workers: sortedActiveWorkers.map((worker) => {
      const agent = agentsByName.get(worker.id);
      const latestWorkerEvent = latestMeaningfulEvent(executionEvents, worker.id);
      const activity = buildWorkerActivityText({ worker, agent, latestEvent: latestWorkerEvent });
      const status = normalizeWorkerStatus(agent?.state || worker.status);
      return {
        workerId: worker.id,
        workerType: agent?.type || worker.type || null,
        workerNumber: worker.workerNumber ?? null,
        title: worker.title?.trim() || null,
        statusKey: statusKeyForWorker(status),
        statusParams: { status: status || worker.status || "active" },
        runtimeLabel: getWorkerRuntimeLabel(worker, nowMs),
        isLive: Boolean(agent?.currentText?.trim()),
        ...activity,
      };
    }),
  };
}
