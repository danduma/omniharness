import { randomUUID } from "crypto";
import { getAgent, type AgentRecord } from "@/server/bridge-client";
import { normalizeGoalFallbackCapabilities } from "@/server/agent-runtime/acp/goal-normalization";
import { emitNamedEvent } from "@/server/events/named-events";
import { goalControl, type GoalControlService } from "@/server/runs/goal-control";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";
import { goalOutboxDispatcher } from "@/server/runs/goal-outbox";
import { parseGoalComposerCommand } from "@/shared/goal-plan";

/**
 * How long to wait for a fresh session's `available_commands` frame. The agent
 * sends it right after the session opens, but not as part of opening it, so a
 * worker that was just spawned may not have advertised `/goal` yet.
 */
const ADVERTISED_COMMANDS_WAIT_MS = 5_000;
const ADVERTISED_COMMANDS_POLL_MS = 100;

type InitialGoalDependencies = {
  control: GoalControlService;
  getAgent(workerId: string): Promise<AgentRecord>;
  sleep(ms: number): Promise<void>;
  refreshDerivedPlan(runId: string): Promise<unknown>;
  publish(): Promise<unknown>;
};

const defaultDependencies: InitialGoalDependencies = {
  control: goalControl,
  getAgent: (workerId) => getAgent(workerId),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  refreshDerivedPlan: async (runId) => {
    const { refreshDerivedGoalPlan } = await import("@/server/runs/goal-plan-derivation");
    return refreshDerivedGoalPlan(runId, "goal_created");
  },
  publish: () => goalOutboxDispatcher.drainPending(),
};

/**
 * The objective of a conversation opened with `/goal <objective>`.
 *
 * The composer sends `/goal` to the goals API only inside an existing
 * conversation. As the opening message there is no run to attach a goal to
 * yet, so it reached the worker as plain chat text behind the harness preamble:
 * no goal was recorded and the agent never received its `/goal` command.
 */
export function readInitialGoalObjective(command: string, hasAttachments: boolean) {
  if (hasAttachments) return null;
  const parsed = parseGoalComposerCommand(command);
  return parsed?.kind === "set" ? parsed.objective : null;
}

function readAdvertisedCommands(agent: AgentRecord) {
  return Array.isArray(agent.advertisedCommands)
    ? agent.advertisedCommands.filter((name): name is string => typeof name === "string")
    : [];
}

async function waitForAdvertisedCommands(
  workerId: string,
  initial: AgentRecord,
  dependencies: InitialGoalDependencies,
) {
  let commands = readAdvertisedCommands(initial);
  const deadline = Date.now() + ADVERTISED_COMMANDS_WAIT_MS;
  while (commands.length === 0 && Date.now() < deadline) {
    await dependencies.sleep(ADVERTISED_COMMANDS_POLL_MS);
    commands = readAdvertisedCommands(await dependencies.getAgent(workerId));
  }
  return commands;
}

export type InitialGoalResult =
  | { kind: "started"; prompt: string }
  | { kind: "skipped"; reason: string };

/**
 * Record the opening goal and lease it to the freshly spawned worker.
 *
 * On success the caller sends the returned prompt as the worker's first turn:
 * it is the `/goal` command itself, exactly what goal dispatch sends to a live
 * worker, so the initial turn's bookkeeping stays in one place. When the agent
 * does not offer `/goal`, nothing is recorded and the caller falls back to the
 * ordinary opening prompt.
 */
export async function startInitialGoal(
  args: { runId: string; workerId: string; agent: AgentRecord; objective: string },
  overrides: Partial<InitialGoalDependencies> = {},
): Promise<InitialGoalResult> {
  const dependencies = { ...defaultDependencies, ...overrides };
  const control = dependencies.control;
  const goalId = randomUUID();
  const operationId = randomUUID();
  emitNamedEvent({ kind: "goal.set.started", runId: args.runId, goalId, operationId });
  const refuse = (reason: string, message: string): InitialGoalResult => {
    emitNamedEvent({ kind: "goal.set.refused", runId: args.runId, goalId, operationId, reason });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.action.unsupported",
      message,
      surface: "banner",
      runId: args.runId,
      workerId: args.workerId,
    });
    return { kind: "skipped", reason };
  };

  const sessionId = args.agent.sessionId?.trim();
  if (!sessionId) {
    return refuse("no_session", "The worker started without a session, so the goal was sent as a message.");
  }

  try {
    const commands = await waitForAdvertisedCommands(args.workerId, args.agent, dependencies);
    const capabilities = normalizeGoalFallbackCapabilities(commands);
    if (!capabilities.set) {
      return refuse("fallback_not_advertised_for_set", "This agent does not support /goal, so it was sent as a message.");
    }

    const created = await control.putGoal({
      runId: args.runId,
      goalId,
      expectedRevision: 0,
      operationId,
      objective: args.objective,
      principalId: `conversation:${args.runId}`,
      endpoint: "goal.put",
    });
    if (!created.ok) {
      emitNamedEvent({ kind: "goal.set.refused", runId: args.runId, goalId, operationId, reason: created.code });
      return { kind: "skipped", reason: created.code };
    }
    const attached = await control.attachLease({
      runId: args.runId,
      goalId,
      expectedRevision: created.snapshot.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
    });
    if (!attached.ok) throw new Error(`The goal lease could not be attached: ${attached.code}`);
    const updated = await control.applyProviderUpdate({
      runId: args.runId,
      goalId,
      expectedRevision: attached.snapshot.revision,
      workerId: args.workerId,
      acpSessionId: sessionId,
      leaseGeneration: attached.snapshot.leaseGeneration,
      capabilities,
    });
    const leased = updated.ok ? updated.snapshot : attached.snapshot;
    // The opening turn is the dispatch, so mark it applied before sending it;
    // otherwise startup recovery would send the same `/goal` a second time.
    await control.markControlApplied(leased, "slash", "set");
    await dependencies.refreshDerivedPlan(args.runId);
    await dependencies.publish();
    return { kind: "started", prompt: `/goal ${leased.objective}` };
  } catch (error) {
    const reason = redactGoalErrorMessage(error);
    emitNamedEvent({ kind: "goal.set.failed", runId: args.runId, goalId, operationId, reason });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "goal.persistence.failed",
      message: reason,
      surface: "banner",
      runId: args.runId,
      workerId: args.workerId,
    });
    return { kind: "skipped", reason };
  }
}
