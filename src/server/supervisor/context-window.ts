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
  readFiles?: Array<{ path: string; content: string; truncated: boolean }>;
  workerHistoryReads?: Array<{ workerId: string; lines: number; content: string; truncated: boolean }>;
  repoInspections?: Array<{ command: string; args: string[]; cwd: string | null; output: string; exitCode: number | null }>;
  preferredWorkerType: string | null;
  allowedWorkerTypes: string[];
  recentUserMessages: string[];
  conversationTurns?: Array<{ role: string; content: string; createdAt: string; kind?: string | null }>;
  pendingClarifications: Array<{ id: string; question: string }>;
  answeredClarifications: Array<{ question: string; answer: string }>;
  activeWorkers: WorkerObservationForPrompt[];
  recentEvents: Array<{ eventType: string; summary: string; createdAt: string; workerId?: string | null }>;
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

function splitMeaningfulLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean);
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

const LOW_SIGNAL_EVENT_TYPES = new Set([
  "supervisor_wait",
  "worker_output_changed",
]);

const SIGNAL_LINE_PATTERN = /\b(error|failed?|failure|success|updated?|fixed?|blocked?|stuck|done|complete[sd]?|verified?|tests?|passing|passed|permission|cancelled?|spawned|prompted|deferred|warning|cannot|missing|conflict|patch|build|lint|typecheck|handoff)\b/i;

function summarizeUserMessages(messages: string[], goal: string) {
  const pieces = messages
    .slice(0, -1)
    .map((message, index) => summarizeText(`Earlier user message ${index + 1}`, message, 480))
    .filter(Boolean);

  if (pieces.length === 0 && goal.trim()) {
    pieces.push(summarizeText("Original goal", goal, 900));
  }

  return pieces.join("\n");
}

function extractUsefulText(text: string, maxLength: number) {
  const lines = splitMeaningfulLines(text);
  const signalLines = lines.filter((line) => SIGNAL_LINE_PATTERN.test(line));
  const selected = (signalLines.length > 0 ? signalLines : lines).slice(-6);
  return truncate(selected.join(" | "), maxLength);
}

function summarizePlanArtifact(context: SupervisorTurnContextForPrompt) {
  if (!context.planPath && !context.planContent?.trim()) {
    return "";
  }

  const planLines = splitMeaningfulLines(context.planContent ?? "");
  const headings = planLines
    .filter((line) => /^#{1,4}\s+/.test(line))
    .map((line) => line.replace(/^#{1,4}\s+/, ""))
    .slice(0, 6);
  const checked = planLines.filter((line) => /-\s+\[[xX]\]/.test(line)).length;
  const unchecked = planLines.filter((line) => /-\s+\[\s\]/.test(line)).length;
  const usefulExcerpt = extractUsefulText(context.planContent ?? "", 500);
  const details = [
    context.planPath ? `path=${context.planPath}` : "",
    checked || unchecked ? `checklist=${checked} checked/${unchecked} open` : "",
    headings.length ? `headings=${headings.join(" > ")}` : "",
    usefulExcerpt ? `useful excerpt=${usefulExcerpt}` : "",
  ].filter(Boolean);

  return details.length ? `Plan artifact summary: ${details.join("; ")}` : "";
}

function summarizeReusableArtifacts(context: SupervisorTurnContextForPrompt) {
  const readFiles = context.readFiles?.slice(0, 6).map((file) => {
    const excerpt = extractUsefulText(file.content, 360) || "(no useful text extracted)";
    return `- file ${file.path}${file.truncated ? " (stored content was truncated)" : ""}: ${excerpt}`;
  }) ?? [];
  const workerHistoryReads = context.workerHistoryReads?.slice(0, 6).map((history) => {
    const excerpt = extractUsefulText(history.content, 480) || "(no useful worker history extracted)";
    return `- worker history ${history.workerId} last ${history.lines} lines${history.truncated ? " (truncated)" : ""}: ${excerpt}`;
  }) ?? [];
  const inspections = context.repoInspections?.slice(0, 6).map((inspection) => {
    const command = [inspection.command, ...inspection.args].join(" ");
    const excerpt = extractUsefulText(inspection.output, 360) || "(no useful output extracted)";
    return `- command ${command}${inspection.cwd ? ` (cwd: ${inspection.cwd})` : ""}, exit=${inspection.exitCode ?? "unknown"}: ${excerpt}`;
  }) ?? [];

  if (readFiles.length === 0 && workerHistoryReads.length === 0 && inspections.length === 0) {
    return "";
  }

  return [
    "Reusable supervisor notes (summarized; raw file and command bodies are intentionally omitted):",
    ...readFiles,
    ...workerHistoryReads,
    ...inspections,
  ].join("\n");
}

function buildObjectiveAndPlanContext(context: SupervisorTurnContextForPrompt, maxLength = 2_400) {
  const sections = [
    context.goal.trim()
      ? `Supervisor-owned objective summary:\n${truncate(normalizeWhitespace(context.goal.trim()), 1_200)}`
      : "",
    summarizePlanArtifact(context),
    summarizeReusableArtifacts(context),
  ].filter(Boolean);

  if (sections.length === 0) {
    return null;
  }

  return truncate([
    "Objective and artifact summaries. Use these as orientation only; do not infer unseen raw contents.",
    "Completion is gated by the original objective and current user turns, not by stale worker chatter.",
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
          "Recent relevant durable events:",
          ...context.recentEvents.filter((event) => !LOW_SIGNAL_EVENT_TYPES.has(event.eventType)).slice(0, 6).map((event) => (
            `- ${event.createdAt} ${event.eventType}: ${truncate(normalizeWhitespace(event.summary), 220)}`
          )),
        ].join("\n")
      : "",
  ].filter(Boolean);

  return truncate(sections.join("\n\n"), 4_000);
}

function getConversationTurns(context: SupervisorTurnContextForPrompt) {
  if (context.conversationTurns?.length) {
    return context.conversationTurns;
  }

  return context.recentUserMessages.map((content, index) => ({
    role: "user",
    content,
    createdAt: `turn-${index + 1}`,
    kind: null,
  }));
}

function buildConversationSummary(context: SupervisorTurnContextForPrompt, maxLength = 6_000) {
  const turns = getConversationTurns(context);
  if (turns.length === 0) {
    return context.goal.trim()
      ? `Original prompt:\n${truncate(normalizeWhitespace(context.goal), 1_200)}`
      : "Original prompt:\n(none recorded)";
  }

  const firstUserTurn = turns.find((turn) => turn.role === "user") ?? turns[0];
  const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user") ?? turns.at(-1) ?? firstUserTurn;
  if (maxLength <= 800) {
    return truncate([
      "Original prompt:",
      truncate(normalizeWhitespace(firstUserTurn.content), 220),
      "",
      "Latest user turn:",
      truncate(normalizeWhitespace(latestUserTurn.content), 360),
    ].join("\n"), maxLength);
  }

  const renderedTurns = turns.map((turn, index) => {
    const kind = turn.kind ? `/${turn.kind}` : "";
    return `- ${index + 1}. ${turn.createdAt} ${turn.role}${kind}: ${truncate(normalizeWhitespace(turn.content), 900)}`;
  });

  return truncate([
    "Original prompt:",
    truncate(normalizeWhitespace(firstUserTurn.content), 1_500),
    "",
    "Conversation turns with the user:",
    ...renderedTurns,
  ].join("\n"), maxLength);
}

function buildRelevantEventSummary(context: SupervisorTurnContextForPrompt, maxLength = 2_400) {
  const counts = new Map<string, number>();
  for (const event of context.recentEvents) {
    counts.set(event.eventType, (counts.get(event.eventType) ?? 0) + 1);
  }

  const relevantEvents = context.recentEvents
    .filter((event) => !LOW_SIGNAL_EVENT_TYPES.has(event.eventType))
    .slice(0, 16);
  const omittedLowSignalCount = context.recentEvents
    .filter((event) => LOW_SIGNAL_EVENT_TYPES.has(event.eventType))
    .length;
  const eventLines = relevantEvents.map((event) => {
    const worker = event.workerId ? ` worker=${event.workerId}` : "";
    return `- ${event.createdAt} ${event.eventType}${worker}: ${truncate(normalizeWhitespace(event.summary), 220)}`;
  });
  const countLine = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([type, count]) => `${type} x${count}`)
    .join(", ");

  return truncate([
    "Relevant activity since user turns:",
    countLine ? `Event mix in retained history: ${countLine}` : "Event mix in retained history: none",
    omittedLowSignalCount > 0
      ? `Omitted low-signal poll/wait events from detail: ${omittedLowSignalCount}`
      : "",
    eventLines.length
      ? eventLines.join("\n")
      : "- No actionable durable events in retained history.",
  ].filter(Boolean).join("\n"), maxLength);
}

function summarizeWorker(worker: WorkerObservationForPrompt, workerTextLimit: number) {
  return {
    workerId: worker.workerId,
    type: worker.type,
    status: worker.status,
    purpose: worker.purpose,
    silenceMs: worker.silenceMs,
    stopReason: worker.stopReason,
    model: worker.effectiveModel ?? worker.requestedModel ?? null,
    effort: worker.effectiveEffort ?? worker.requestedEffort ?? null,
    pendingPermissions: worker.pendingPermissions?.map((permission) => ({
      requestId: permission.requestId,
      requestedAt: permission.requestedAt,
      options: permission.options?.map((option) => `${option.kind}:${option.name}`) ?? [],
    })) ?? [],
    usefulCurrentText: workerTextLimit > 0 ? extractUsefulText(worker.currentText || "", workerTextLimit) : "",
    usefulLastText: workerTextLimit > 0 ? extractUsefulText(worker.lastText || "", Math.min(workerTextLimit, 500)) : "",
    stderrTail: workerTextLimit > 0 ? extractUsefulText(worker.stderrTail || "", Math.min(workerTextLimit, 300)) : "",
  };
}

function findLastActionableEvent(context: SupervisorTurnContextForPrompt) {
  return context.recentEvents.find((event) => !LOW_SIGNAL_EVENT_TYPES.has(event.eventType))
    ?? context.recentEvents[0]
    ?? null;
}

function buildWakeReason(context: SupervisorTurnContextForPrompt) {
  const latest = context.recentEvents[0] ?? null;
  const actionable = findLastActionableEvent(context);
  const lines = ["Reason for this supervisor wake-up:"];

  if (!latest) {
    lines.push("- No durable wake event was retained; inspect current worker state and decide the next supervision action.");
  } else if (actionable && actionable !== latest) {
    lines.push(`- Latest recorded event is low-signal ${latest.eventType} at ${latest.createdAt}; do not overfit to it.`);
    lines.push(`- Last actionable event: ${actionable.createdAt} ${actionable.eventType}${actionable.workerId ? ` worker=${actionable.workerId}` : ""}: ${truncate(normalizeWhitespace(actionable.summary), 320)}`);
  } else {
    lines.push(`- Latest actionable event: ${latest.createdAt} ${latest.eventType}${latest.workerId ? ` worker=${latest.workerId}` : ""}: ${truncate(normalizeWhitespace(latest.summary), 320)}`);
  }

  lines.push("- Decide whether to wait, ask the user, redirect/cancel a worker, validate completion, or fail the run.");
  return lines.join("\n");
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
    activeWorkers: context.activeWorkers.map((worker) => summarizeWorker(worker, options.workerTextLimit)),
    recentEvents: context.recentEvents
      .filter((event) => !LOW_SIGNAL_EVENT_TYPES.has(event.eventType))
      .slice(0, options.eventLimit),
    runStatus,
  }, null, 2);
}

function buildMessages(args: {
  systemPrompt: string;
  context: SupervisorTurnContextForPrompt;
  objectiveAndPlanContext: string | null;
  memorySummary: string | null;
  observationSummary: string;
  conversationMaxLength?: number;
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

  messages.push({
    role: "user" as const,
    content: [
      "Supervisor decision brief:",
      "",
      buildConversationSummary(args.context, args.conversationMaxLength),
      "",
      buildRelevantEventSummary(args.context),
      "",
      args.objectiveAndPlanContext,
      "",
      "Current worker state and run snapshot:",
      args.observationSummary,
      "",
      buildWakeReason(args.context),
    ].filter(Boolean).join("\n"),
  });

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
  const workerTextLimits = [900, 600, 360, 180, 0];
  const eventLimits = [12, 8, 4, 2, 0];
  const objectiveContextLimits = [1_600, 900, 480, 240, 0];
  const conversationLimits = [6_000, 3_000, 1_600, 900, 500];

  for (const objectiveContextLimit of objectiveContextLimits) {
    for (const workerTextLimit of workerTextLimits) {
      for (const eventLimit of eventLimits) {
        for (const conversationMaxLength of conversationLimits) {
          const observationSummary = buildObservationSummary(args.context, args.heartbeatCount, args.runStatus, {
            workerTextLimit,
            eventLimit,
          });
          const objectiveAndPlanContext = objectiveContextLimit > 0
            ? buildObjectiveAndPlanContext(args.context, objectiveContextLimit)
            : null;
          const messages = buildMessages({
            systemPrompt: args.systemPrompt,
            context: args.context,
            objectiveAndPlanContext,
            memorySummary: args.memorySummary,
            observationSummary,
            conversationMaxLength,
          });

          if (estimateContextTokens(messages) <= args.budgetTokens) {
            return messages;
          }
        }
      }
    }
  }

  const minimalMemory = truncate(args.memorySummary, 600);
  const minimalObservation = buildObservationSummary(args.context, args.heartbeatCount, args.runStatus, {
    workerTextLimit: 0,
    eventLimit: 0,
  });

  return buildMessages({
    systemPrompt: truncate(args.systemPrompt, Math.max(400, args.budgetTokens)),
    context: {
      ...args.context,
      conversationTurns: getConversationTurns(args.context).slice(-2),
      recentUserMessages: args.context.recentUserMessages.slice(-2),
      recentEvents: args.context.recentEvents.slice(0, 2),
    },
    objectiveAndPlanContext: truncate(buildObjectiveAndPlanContext(args.context) ?? "", 160) || null,
    memorySummary: minimalMemory,
    observationSummary: minimalObservation,
    conversationMaxLength: 500,
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
    context: args.context,
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
