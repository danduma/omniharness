// Pure classification of a worker's visible activity for the office view and
// the compact status strip. No React imports. Inputs are the already-loaded
// worker record and live agent snapshot; nothing here re-derives server
// decisions beyond mapping existing statuses to a display vocabulary.

import { normalizeWorkerStatus } from "@/lib/conversation-workers";
import {
  AGENT_ACTIVITIES,
  classifyToolActivity,
  type AgentActivity,
  type StreamAgentActivity,
  type ToolActivity,
  type ToolCallLike,
} from "@/shared/agent-activity";

export { AGENT_ACTIVITIES, classifyToolActivity };
export type { AgentActivity, ToolActivity };

export type AgentActivityInput = {
  workerStatus: string | null | undefined;
  agentState?: string | null;
  pendingPermissionCount?: number;
  pendingElicitationCount?: number;
  latestToolCall?: ToolCallLike;
  /** Latest server-derived `worker.activity`; refines a worker that is working. */
  streamActivity?: StreamAgentActivity | null;
};

const WAITING_STATUSES = new Set(["awaiting_user", "waiting", "waiting_user", "needs_input"]);
const BLOCKED_STATUSES = new Set(["stuck", "lost", "needs_recovery", "blocked"]);
const QUOTA_STATUSES = new Set(["cred-exhausted", "quota_exhausted", "quota_blocked"]);
const ERROR_STATUSES = new Set(["error", "failed"]);
const DONE_STATUSES = new Set(["completed", "done"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "stopped"]);

function classifyStatus(status: string): AgentActivity | null {
  if (WAITING_STATUSES.has(status)) return "waiting_user";
  if (QUOTA_STATUSES.has(status)) return "quota_blocked";
  if (BLOCKED_STATUSES.has(status)) return "blocked";
  if (ERROR_STATUSES.has(status)) return "errored";
  if (CANCELLED_STATUSES.has(status)) return "cancelled";
  if (DONE_STATUSES.has(status)) return "done";
  if (status === "recovering") return "recovering";
  if (status === "starting") return "starting";
  if (status === "idle") return "idle";
  if (status === "working") return "working";
  return null;
}

export function deriveAgentActivity(input: AgentActivityInput): AgentActivity {
  // A pending request is the one state the user must act on, so it wins over
  // whatever the worker reports it is doing.
  if ((input.pendingPermissionCount ?? 0) > 0 || (input.pendingElicitationCount ?? 0) > 0) {
    return "waiting_user";
  }

  const workerStatus = normalizeWorkerStatus(input.workerStatus);
  const agentState = normalizeWorkerStatus(input.agentState);
  const persisted = classifyStatus(workerStatus);

  // Persisted terminal and blocking statuses are authoritative; the live agent
  // state only refines working/idle for a worker that is still running.
  if (persisted && persisted !== "working" && persisted !== "idle" && persisted !== "starting") {
    return persisted;
  }

  const live = classifyStatus(agentState);
  if (live && live !== "working" && live !== "idle") {
    return live;
  }

  const effective = live ?? persisted ?? "idle";
  if (effective === "working") {
    if (input.streamActivity && input.streamActivity !== "working") {
      return input.streamActivity;
    }
    return classifyToolActivity(input.latestToolCall) ?? "working";
  }
  return effective;
}

/** Activities that need the user's attention, in the order they should be surfaced. */
export function isAttentionActivity(activity: AgentActivity) {
  return activity === "waiting_user" || activity === "blocked" || activity === "quota_blocked" || activity === "errored";
}

/** Activity for one worker card/desk, combining the persisted record, live agent and stream activity. */
export function deriveWorkerRecordActivity(
  worker: { status: string },
  agent: {
    state?: string | null;
    pendingPermissions?: readonly unknown[] | null;
    pendingElicitations?: readonly unknown[] | null;
  } | null | undefined,
  streamActivity: StreamAgentActivity | null | undefined,
): AgentActivity {
  return deriveAgentActivity({
    workerStatus: worker.status,
    agentState: agent?.state,
    pendingPermissionCount: agent?.pendingPermissions?.length ?? 0,
    pendingElicitationCount: agent?.pendingElicitations?.length ?? 0,
    streamActivity: streamActivity ?? null,
  });
}
