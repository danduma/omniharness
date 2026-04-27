type SupervisorModelMessage = {
  role: "system" | "user";
  content: string;
};

export interface WorkerObservationForPrompt {
  workerId: string;
  type: string;
  status: string;
  purpose: string | null;
  silenceMs: number;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  currentText: string;
  lastText: string;
  stderrTail: string;
  stopReason: string | null;
}

export interface SupervisorTurnContextForPrompt {
  runId: string;
  projectPath: string | null;
  goal: string;
  planPath?: string | null;
  planContent?: string | null;
  preferredWorkerType: string | null;
  allowedWorkerTypes: string[];
  recentUserMessages: string[];
  pendingClarifications: Array<{ id: string; question: string }>;
  answeredClarifications: Array<{ question: string; answer: string }>;
  activeWorkers: WorkerObservationForPrompt[];
  recentEvents: Array<{ eventType: string; summary: string; createdAt: string }>;
  compactedMemory?: string | null;
}

export interface SupervisorContextBudget {
  maxContextTokens: number;
  responseReserveTokens: number;
  compactionThreshold: number;
}

export interface SupervisorPromptBundle {
  messages: SupervisorModelMessage[];
  stats: {
    compacted: boolean;
    estimatedTokens: number;
    budgetTokens: number;
    memorySummary: string | null;
    reason: string | null;
  };
}

const DEFAULT_MAX_CONTEXT_TOKENS = 64_000;
const DEFAULT_RESPONSE_RESERVE_TOKENS = 4_000;
const DEFAULT_COMPACTION_THRESHOLD = 0.82;
const MIN_BUDGET_TOKENS = 500;

function parsePositiveInteger(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseThreshold(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(0.95, Math.max(0.25, parsed));
}

function truncate(text: string, maxLength: number) {
  if (maxLength <= 0) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, Math.max(0, maxLength - 3))}...` : text;
}

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function asMessageText(message: SupervisorModelMessage) {
  return `${message.role}: ${message.content}`;
}

export function estimateContextTokens(value: string | SupervisorModelMessage[] | unknown) {
  const text = typeof value === "string"
    ? value
    : Array.isArray(value)
      ? value.map(asMessageText).join("\n\n")
      : JSON.stringify(value);
  return Math.ceil((text || "").length / 4);
}

export function getSupervisorContextBudget(env: NodeJS.ProcessEnv = process.env): SupervisorContextBudget {
  const maxContextTokens = parsePositiveInteger(
    env.SUPERVISOR_CONTEXT_WINDOW_TOKENS,
    DEFAULT_MAX_CONTEXT_TOKENS,
  );
  const responseReserveTokens = parsePositiveInteger(
    env.SUPERVISOR_CONTEXT_RESPONSE_RESERVE_TOKENS,
    DEFAULT_RESPONSE_RESERVE_TOKENS,
  );

  return {
    maxContextTokens,
    responseReserveTokens,
    compactionThreshold: parseThreshold(
      env.SUPERVISOR_CONTEXT_COMPACTION_THRESHOLD,
      DEFAULT_COMPACTION_THRESHOLD,
    ),
  };
}

function usableBudgetTokens(budget: SupervisorContextBudget) {
  return Math.max(MIN_BUDGET_TOKENS, budget.maxContextTokens - budget.responseReserveTokens);
}

function compactionTriggerTokens(budget: SupervisorContextBudget) {
  return Math.floor(usableBudgetTokens(budget) * budget.compactionThreshold);
}

function summarizeText(label: string, text: string, maxLength: number) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return "";
  }

  return `- ${label}: ${truncate(normalized, maxLength)}`;
}

function summarizeUserMessages(messages: string[], goal: string) {
  const olderMessages = messages.slice(0, -1);
  const pieces = olderMessages
    .map((message, index) => summarizeText(`Earlier user message ${index + 1}`, message, 480))
    .filter(Boolean);

  if (pieces.length === 0 && goal.trim()) {
    pieces.push(summarizeText("Original goal", goal, 900));
  }

  return pieces.join("\n");
}

function buildObjectiveAndPlanContext(context: SupervisorTurnContextForPrompt, maxLength = 16_000) {
  const sections = [
    context.goal.trim()
      ? `Supervisor-owned objective:\n${truncate(context.goal.trim(), 4_000)}`
      : "",
    context.planContent?.trim()
      ? [
          `Plan artifact${context.planPath ? ` (${context.planPath})` : ""}:`,
          truncate(context.planContent.trim(), 12_000),
        ].join("\n")
      : context.planPath
        ? `Plan artifact: ${context.planPath}`
        : "",
  ].filter(Boolean);

  if (sections.length === 0) {
    return null;
  }

  return truncate([
    "Use this objective and plan context to decide whether the run is complete.",
    "The checklist is implementation guidance; completion is gated by the original objective.",
    ...sections,
  ].join("\n\n"), maxLength);
}

function buildMemorySummary(context: SupervisorTurnContextForPrompt, sourceMessages: string[]) {
  const sections = [
    context.compactedMemory?.trim()
      ? `Existing rolling memory:\n${truncate(context.compactedMemory.trim(), 2_400)}`
      : "",
    buildObjectiveAndPlanContext(context),
    summarizeUserMessages(sourceMessages, context.goal),
    context.answeredClarifications.length > 0
      ? [
          "Answered clarifications:",
          ...context.answeredClarifications.map((item, index) => {
            const question = truncate(normalizeWhitespace(item.question), 240);
            const answer = truncate(normalizeWhitespace(item.answer), 320);
            return `- ${index + 1}. Q: ${question} A: ${answer}`;
          }),
        ].join("\n")
      : "",
    context.recentEvents.length > 0
      ? [
          "Recent durable events:",
          ...context.recentEvents.slice(0, 6).map((event) => (
            `- ${event.createdAt} ${event.eventType}: ${truncate(normalizeWhitespace(event.summary), 220)}`
          )),
        ].join("\n")
      : "",
  ].filter(Boolean);

  return truncate(sections.join("\n\n"), 4_000);
}

function buildObservationSummary(
  context: SupervisorTurnContextForPrompt,
  heartbeatCount: number,
  runStatus: string,
  options: { workerTextLimit: number; eventLimit: number },
) {
  return JSON.stringify({
    heartbeatCount,
    projectPath: context.projectPath,
    preferredWorkerType: context.preferredWorkerType,
    allowedWorkerTypes: context.allowedWorkerTypes,
    pendingClarifications: context.pendingClarifications,
    answeredClarifications: context.answeredClarifications,
    activeWorkers: context.activeWorkers.map((worker) => ({
      ...worker,
      currentText: truncate(worker.currentText || "", options.workerTextLimit),
      lastText: truncate(worker.lastText || "", options.workerTextLimit),
      stderrTail: truncate(worker.stderrTail || "", Math.min(options.workerTextLimit, 500)),
    })),
    recentEvents: context.recentEvents.slice(0, options.eventLimit),
    runStatus,
  }, null, 2);
}

function buildMessages(args: {
  systemPrompt: string;
  userMessages: string[];
  objectiveAndPlanContext: string | null;
  memorySummary: string | null;
  observationSummary: string;
}) {
  const messages: SupervisorModelMessage[] = [
    { role: "system", content: args.systemPrompt },
  ];

  if (args.memorySummary) {
    messages.push({
      role: "system",
      content: `Prior supervision memory (compacted to fit the context window):\n\n${args.memorySummary}`,
    });
  }

  if (args.objectiveAndPlanContext) {
    messages.push({
      role: "system",
      content: args.objectiveAndPlanContext,
    });
  }

  messages.push(
    ...args.userMessages.map((content) => ({ role: "user" as const, content })),
    {
      role: "system" as const,
      content: `Current supervision snapshot:\n\n${args.observationSummary}`,
    },
  );

  return messages;
}

function fitMessagesIntoBudget(args: {
  systemPrompt: string;
  context: SupervisorTurnContextForPrompt;
  heartbeatCount: number;
  runStatus: string;
  budgetTokens: number;
  memorySummary: string;
}) {
  const workerTextLimits = [1_200, 800, 500, 240, 0];
  const eventLimits = [8, 6, 4, 2, 0];
  const objectiveContextLimits = [2_400, 1_200, 600, 240, 0];

  for (const objectiveContextLimit of objectiveContextLimits) {
    for (const workerTextLimit of workerTextLimits) {
      for (const eventLimit of eventLimits) {
        const observationSummary = buildObservationSummary(args.context, args.heartbeatCount, args.runStatus, {
          workerTextLimit,
          eventLimit,
        });
        const objectiveAndPlanContext = objectiveContextLimit > 0
          ? buildObjectiveAndPlanContext(args.context, objectiveContextLimit)
          : null;
        const keptUserMessages: string[] = [];

        for (const message of [...args.context.recentUserMessages].reverse()) {
          const nextMessages = buildMessages({
            systemPrompt: args.systemPrompt,
            userMessages: [message, ...keptUserMessages],
            objectiveAndPlanContext,
            memorySummary: args.memorySummary,
            observationSummary,
          });
          if (estimateContextTokens(nextMessages) > args.budgetTokens) {
            break;
          }
          keptUserMessages.unshift(message);
        }

        const messages = buildMessages({
          systemPrompt: args.systemPrompt,
          userMessages: keptUserMessages,
          objectiveAndPlanContext,
          memorySummary: args.memorySummary,
          observationSummary,
        });

        if (estimateContextTokens(messages) <= args.budgetTokens) {
          return messages;
        }
      }
    }
  }

  const minimalMemory = truncate(args.memorySummary, 1_200);
  const minimalObservation = buildObservationSummary(args.context, args.heartbeatCount, args.runStatus, {
    workerTextLimit: 0,
    eventLimit: 0,
  });
  const latestUserMessage = args.context.recentUserMessages.at(-1);

  return buildMessages({
    systemPrompt: truncate(args.systemPrompt, Math.max(800, args.budgetTokens)),
    userMessages: latestUserMessage ? [truncate(latestUserMessage, Math.max(400, args.budgetTokens))] : [],
    objectiveAndPlanContext: truncate(buildObjectiveAndPlanContext(args.context) ?? "", 240) || null,
    memorySummary: minimalMemory,
    observationSummary: minimalObservation,
  });
}

export function buildSupervisorModelMessages(args: {
  systemPrompt: string;
  context: SupervisorTurnContextForPrompt;
  heartbeatCount: number;
  runStatus: string;
  budget?: SupervisorContextBudget;
}): SupervisorPromptBundle {
  const budget = args.budget ?? getSupervisorContextBudget();
  const budgetTokens = usableBudgetTokens(budget);
  const observationSummary = buildObservationSummary(args.context, args.heartbeatCount, args.runStatus, {
    workerTextLimit: 2_000,
    eventLimit: 8,
  });
  const normalMessages = buildMessages({
    systemPrompt: args.systemPrompt,
    userMessages: args.context.recentUserMessages,
    objectiveAndPlanContext: buildObjectiveAndPlanContext(args.context),
    memorySummary: args.context.compactedMemory?.trim() || null,
    observationSummary,
  });
  const normalTokens = estimateContextTokens(normalMessages);

  if (normalTokens <= compactionTriggerTokens(budget)) {
    return {
      messages: normalMessages,
      stats: {
        compacted: false,
        estimatedTokens: normalTokens,
        budgetTokens,
        memorySummary: args.context.compactedMemory?.trim() || null,
        reason: null,
      },
    };
  }

  const memorySummary = buildMemorySummary(args.context, args.context.recentUserMessages);
  const compactedMessages = fitMessagesIntoBudget({
    systemPrompt: args.systemPrompt,
    context: args.context,
    heartbeatCount: args.heartbeatCount,
    runStatus: args.runStatus,
    budgetTokens,
    memorySummary,
  });

  return {
    messages: compactedMessages,
    stats: {
      compacted: true,
      estimatedTokens: estimateContextTokens(compactedMessages),
      budgetTokens,
      memorySummary,
      reason: `Estimated prompt was ${normalTokens} tokens, above compaction trigger ${compactionTriggerTokens(budget)}.`,
    },
  };
}
