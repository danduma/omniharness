import { normalizeAcpGoalMetadata } from "@/server/agent-runtime/acp/goal-state";
import { emitNamedEvent } from "@/server/events/named-events";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import { isAgentBusyError, isMissingAgentError } from "@/server/supervisor/retry";
import type { GoalMutationAction, GoalSnapshot } from "@/shared/goal-plan";

interface GoalAcpAgentSnapshot {
  agentCapabilities?: unknown;
  outputEntries?: Array<{ type?: unknown; raw?: unknown }>;
}

interface GoalAcpDependencies {
  getAgent(workerId: string): Promise<GoalAcpAgentSnapshot>;
  invokeExtension(workerId: string, method: string, params: Record<string, unknown>): Promise<unknown>;
  /**
   * Settles when the turn the command started ends. `onAccepted` fires as soon
   * as the runtime has taken the prompt.
   */
  sendSlashCommand(workerId: string, command: string, options?: { onAccepted?: () => void }): Promise<unknown>;
}

export type GoalAcpDispatchResult =
  | { kind: "dispatched"; method: "extension" | "slash" }
  | { kind: "deferred"; reason: "no_active_lease" | "worker_busy" }
  | { kind: "unsupported"; reason: string };

/**
 * How long a turn-starting extension call may stay unanswered before it counts
 * as accepted. codex-acp answers `_session/goal` set/resume only when the turn
 * it starts ends — for a goal, the whole job — while a refusal (busy, unknown
 * session) arrives at once.
 */
export const GOAL_EXTENSION_ACCEPTANCE_WINDOW_MS = 15_000;

/** codex-acp refuses `/goal <objective>` above this length. */
const SLASH_GOAL_OBJECTIVE_MAX_LENGTH = 4_000;

const defaultDependencies: GoalAcpDependencies = {
  getAgent: async (workerId) => {
    const { getAgent } = await import("@/server/bridge-client");
    return getAgent(workerId);
  },
  invokeExtension: async (workerId, method, params) => {
    const { invokeAgentAcpMethod } = await import("@/server/bridge-client");
    return invokeAgentAcpMethod(workerId, method, params);
  },
  sendSlashCommand: async (workerId, command, options) => {
    const { askAgent } = await import("@/server/bridge-client");
    return askAgent(workerId, command, undefined, { onAccepted: options?.onAccepted });
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function metadataGoal(agentCapabilities: unknown) {
  if (!isRecord(agentCapabilities) || !isRecord(agentCapabilities._meta)) return null;
  return isRecord(agentCapabilities._meta.goal) ? agentCapabilities._meta.goal : null;
}

function advertisedCommands(entries: GoalAcpAgentSnapshot["outputEntries"]) {
  const commands = new Set<string>();
  if (!entries) return commands;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "available_commands" || !isRecord(entry.raw)) continue;
    const available = entry.raw.availableCommands;
    if (!Array.isArray(available)) continue;
    for (const command of available) {
      if (!isRecord(command) || typeof command.name !== "string") continue;
      commands.add(command.name.trim().replace(/^\//, "").toLowerCase());
    }
    break;
  }
  return commands;
}

function extensionSupports(metadata: ReturnType<typeof normalizeAcpGoalMetadata>, action: GoalMutationAction) {
  if (!metadata.ok) return false;
  if (action === "set" || action === "retry") return metadata.value.capabilities.set;
  if (action === "edit") return metadata.value.capabilities.edit;
  return metadata.value.capabilities[action];
}

function advertisesEdit(metadata: Record<string, unknown>) {
  const capabilities = metadata.capabilities;
  return (capabilities !== null && typeof capabilities === "object" && "edit" in capabilities && capabilities.edit === true)
    || (Array.isArray(metadata.actions) && metadata.actions.includes("edit"));
}

function recordedFallbackSupports(capabilities: GoalSnapshot["capabilities"], action: GoalMutationAction) {
  if (!capabilities.fallbackMethod) return false;
  if (action === "set" || action === "retry") return capabilities.set;
  if (action === "edit") return capabilities.edit;
  return capabilities[action];
}

function fallbackCommand(snapshot: GoalSnapshot, action: GoalMutationAction) {
  if (action === "set" || action === "edit") return `/goal ${snapshot.objective}`;
  if (action === "retry") return `/goal ${snapshot.objective}`;
  return `/goal ${action}`;
}

/** Actions after which the agent works the goal in a turn of its own. */
function startsTurn(action: GoalMutationAction) {
  return action === "set" || action === "edit" || action === "retry" || action === "resume";
}

function slashCommandFits(snapshot: GoalSnapshot, action: GoalMutationAction) {
  return action === "resume" || snapshot.objective.length <= SLASH_GOAL_OBJECTIVE_MAX_LENGTH;
}

export class GoalAcpDispatcher {
  constructor(private readonly dependencies: GoalAcpDependencies = defaultDependencies) {}

  async dispatch(snapshot: GoalSnapshot, action: GoalMutationAction): Promise<GoalAcpDispatchResult> {
    if (!snapshot.workerId || !snapshot.acpSessionId) {
      return { kind: "deferred", reason: "no_active_lease" };
    }
    let agent: GoalAcpAgentSnapshot;
    try {
      agent = await this.dependencies.getAgent(snapshot.workerId);
    } catch (error) {
      // The lease still names a worker the runtime no longer hosts — the run
      // finished, the process was reaped, or the session was dropped. That is
      // the same situation as holding no lease at all, so defer instead of
      // burning the goal into `error`; the next worker to attach reconciles it.
      // Treating this as a transport failure left `/goal` dead for the rest of
      // the session with "Get agent failed: not_found".
      if (!isMissingAgentError(error)) throw error;
      return { kind: "deferred", reason: "no_active_lease" };
    }
    const goalMetadata = metadataGoal(agent.agentCapabilities);
    const extensionSupported = goalMetadata !== null
      && extensionSupports(normalizeAcpGoalMetadata({ _meta: { goal: goalMetadata } }), action);

    // Trust the capabilities the runtime already recorded from the agent's
    // available_commands frame before re-deriving them. `outputEntries` is a
    // rolling window that drops that frame once the session produces enough
    // output, and after a session resume it never reappears — so scanning it
    // alone reported `fallback_not_advertised_for_*` for workers that do
    // advertise `/goal`.
    const commands = advertisedCommands(agent.outputEntries);
    const slashSupported = recordedFallbackSupports(snapshot.capabilities, action)
      || (action === "pause" || action === "resume"
        ? commands.has(`goal ${action}`) || commands.has(`${action}-goal`)
        : commands.has("goal"));

    // An action that starts the goal's turn goes through `/goal` when the agent
    // offers it. Only a prompt gives the runtime a tracked turn: codex-acp
    // forwards a turn's output only for turns a prompt started, so a resume over
    // the extension ran with no visible output and the worker read as idle
    // while Codex worked.
    if (startsTurn(action) && slashSupported && slashCommandFits(snapshot, action)) {
      return await this.dispatchSlash(snapshot, action);
    }
    if (goalMetadata && extensionSupported) {
      return await this.dispatchExtension(snapshot, action, goalMetadata);
    }

    // Reaching here means the agent advertises no goal extension, or advertises
    // one that declines this action. Codex is the second case: it announces
    // goals over the extension while reporting every capability false, so an
    // extension-only dispatch refused every resume and the goal had no way back
    // to `pursuing`. The slash command is a real fallback for exactly that
    // agent, so try it before calling the action unsupported.
    if (!slashSupported) {
      return { kind: "unsupported", reason: `fallback_not_advertised_for_${action}` };
    }
    return await this.dispatchSlash(snapshot, action);
  }

  private async dispatchExtension(
    snapshot: GoalSnapshot,
    action: GoalMutationAction,
    goalMetadata: Record<string, unknown>,
  ): Promise<GoalAcpDispatchResult> {
    const request = this.dependencies.invokeExtension(snapshot.workerId!, "_session/goal", {
      sessionId: snapshot.acpSessionId,
      goalId: snapshot.goalId,
      revision: snapshot.revision,
      action: action === "retry" || (action === "edit" && !advertisesEdit(goalMetadata)) ? "set" : action,
      ...(action === "set" || action === "edit" || action === "retry"
        ? { objective: snapshot.objective }
        : {}),
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (startsTurn(action)) {
        const window = new Promise<void>((resolve) => {
          timer = setTimeout(resolve, GOAL_EXTENSION_ACCEPTANCE_WINDOW_MS);
          timer.unref?.();
        });
        await this.untilAccepted(snapshot, action, "extension", request, window);
      } else {
        await request;
      }
    } catch (error) {
      if (!isAgentBusyError(error)) throw error;
      return { kind: "deferred", reason: "worker_busy" };
    } finally {
      clearTimeout(timer);
    }
    return { kind: "dispatched", method: "extension" };
  }

  private async dispatchSlash(snapshot: GoalSnapshot, action: GoalMutationAction): Promise<GoalAcpDispatchResult> {
    try {
      // The ask stream stays open until the turn `/goal` started ends, so the
      // dispatch settles once the runtime has taken the prompt.
      let onAccepted: () => void = () => {};
      const acceptance = new Promise<void>((resolve) => {
        onAccepted = resolve;
      });
      const request = this.dependencies.sendSlashCommand(snapshot.workerId!, fallbackCommand(snapshot, action), {
        onAccepted: () => onAccepted(),
      });
      await this.untilAccepted(snapshot, action, "slash", request, acceptance);
    } catch (error) {
      // The slash fallback is a prompt, and a prompt cannot start while the
      // agent is mid-turn. That is a "not yet", not a broken transport: burning
      // it into `error` left the goal dead for the rest of the session, and
      // every retry the user pressed while the turn ran repeated the same
      // failure. Defer instead; the turn-settled reconciliation re-dispatches.
      if (!isAgentBusyError(error)) throw error;
      return { kind: "deferred", reason: "worker_busy" };
    }
    return { kind: "dispatched", method: "slash" };
  }

  /**
   * Resolve when `request` settles or the agent has accepted it, whichever
   * comes first. A request still running after acceptance keeps running with
   * the agent's turn; if it later fails, that is reported, not rethrown.
   */
  private async untilAccepted(
    snapshot: GoalSnapshot,
    action: GoalMutationAction,
    method: "extension" | "slash",
    request: Promise<unknown>,
    acceptance: Promise<void>,
  ) {
    let accepted = false;
    const acceptedFirst = acceptance.then(() => {
      accepted = true;
    });
    request.catch((error: unknown) => {
      if (!accepted) return;
      emitNamedEvent({
        kind: "goal.control.failed_after_acceptance",
        runId: snapshot.runId,
        goalId: snapshot.goalId,
        workerId: snapshot.workerId!,
        action,
        method,
        reason: redactGoalErrorMessage(error),
      });
    });
    await Promise.race([request, acceptedFirst]);
  }
}

export function createGoalAcpDispatcher(dependencies: GoalAcpDependencies = defaultDependencies) {
  return new GoalAcpDispatcher(dependencies);
}

export const goalAcpDispatcher = createGoalAcpDispatcher();
