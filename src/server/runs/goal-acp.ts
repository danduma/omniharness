import { normalizeAcpGoalMetadata } from "@/server/agent-runtime/acp/goal-state";
import { isMissingAgentError } from "@/server/supervisor/retry";
import type { GoalMutationAction, GoalSnapshot } from "@/shared/goal-plan";

interface GoalAcpAgentSnapshot {
  agentCapabilities?: unknown;
  outputEntries?: Array<{ type?: unknown; raw?: unknown }>;
}

interface GoalAcpDependencies {
  getAgent(workerId: string): Promise<GoalAcpAgentSnapshot>;
  invokeExtension(workerId: string, method: string, params: Record<string, unknown>): Promise<unknown>;
  sendSlashCommand(workerId: string, command: string): Promise<unknown>;
}

export type GoalAcpDispatchResult =
  | { kind: "dispatched"; method: "extension" | "slash" }
  | { kind: "deferred"; reason: "no_active_lease" }
  | { kind: "unsupported"; reason: string };

const defaultDependencies: GoalAcpDependencies = {
  getAgent: async (workerId) => {
    const { getAgent } = await import("@/server/bridge-client");
    return getAgent(workerId);
  },
  invokeExtension: async (workerId, method, params) => {
    const { invokeAgentAcpMethod } = await import("@/server/bridge-client");
    return invokeAgentAcpMethod(workerId, method, params);
  },
  sendSlashCommand: async (workerId, command) => {
    const { askAgent } = await import("@/server/bridge-client");
    return askAgent(workerId, command);
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
    if (goalMetadata) {
      const normalized = normalizeAcpGoalMetadata({ _meta: { goal: goalMetadata } });
      if (!extensionSupports(normalized, action)) {
        return { kind: "unsupported", reason: normalized.ok ? `extension_does_not_support_${action}` : normalized.reason };
      }
      await this.dependencies.invokeExtension(snapshot.workerId, "_session/goal", {
        sessionId: snapshot.acpSessionId,
        goalId: snapshot.goalId,
        revision: snapshot.revision,
        action: action === "retry" ? "set" : action,
        ...(action === "set" || action === "edit" || action === "retry"
          ? { objective: snapshot.objective }
          : {}),
      });
      return { kind: "dispatched", method: "extension" };
    }

    // Trust the capabilities the runtime already recorded from the agent's
    // available_commands frame before re-deriving them. `outputEntries` is a
    // rolling window that drops that frame once the session produces enough
    // output, and after a session resume it never reappears — so scanning it
    // alone reported `fallback_not_advertised_for_*` for workers that do
    // advertise `/goal`.
    const commands = advertisedCommands(agent.outputEntries);
    const supported = recordedFallbackSupports(snapshot.capabilities, action)
      || (action === "pause" || action === "resume"
        ? commands.has(`goal ${action}`) || commands.has(`${action}-goal`)
        : commands.has("goal"));
    if (!supported) {
      return { kind: "unsupported", reason: `fallback_not_advertised_for_${action}` };
    }
    await this.dependencies.sendSlashCommand(snapshot.workerId, fallbackCommand(snapshot, action));
    return { kind: "dispatched", method: "slash" };
  }
}

export function createGoalAcpDispatcher(dependencies: GoalAcpDependencies = defaultDependencies) {
  return new GoalAcpDispatcher(dependencies);
}

export const goalAcpDispatcher = createGoalAcpDispatcher();
