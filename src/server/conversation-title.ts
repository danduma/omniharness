import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { CONVERSATION_TITLE_SYSTEM_PROMPT } from "@/server/prompts";
import { formatErrorMessage } from "@/server/runs/failures";
import {
  CodexAuthMissingError,
  ensureFreshCodexCredentials,
  readCodexCredentialsSync,
} from "@/server/auth/codex-auth";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";
import { isConversationTitleOwningWorker } from "@/server/conversations/agent-session-title";

const MAX_TITLE_CONTEXT_CHARS = 4_000;
const MAX_COMPLETED_TITLE_GENERATIONS = 5_000;
const titleGenerationInFlight = new Map<string, Promise<ConversationTitleGenerationOutcome>>();
const completedTitleGenerationRunIds = new Set<string>();

type ConversationTitleInput = {
  userMessage: string;
  assistantReply: string;
};

type ConversationTitleGenerationOutcome = "updated" | "skipped" | "superseded";

function rememberCompletedTitleGeneration(runId: string) {
  completedTitleGenerationRunIds.delete(runId);
  completedTitleGenerationRunIds.add(runId);
  if (completedTitleGenerationRunIds.size <= MAX_COMPLETED_TITLE_GENERATIONS) {
    return;
  }
  const oldest = completedTitleGenerationRunIds.values().next().value;
  if (oldest) {
    completedTitleGenerationRunIds.delete(oldest);
  }
}

function fallbackTitle(command: string) {
  const cleaned = command
    .replace(/\s+/g, " ")
    .replace(/^[/~.\w-]+\/\s*/, "")
    .trim();

  if (!cleaned) {
    return "New conversation";
  }

  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildTitleContext(input: ConversationTitleInput) {
  return [
    "User's opening message:",
    input.userMessage.trim().slice(0, MAX_TITLE_CONTEXT_CHARS),
    "",
    "Assistant's first reply:",
    input.assistantReply.trim().slice(0, MAX_TITLE_CONTEXT_CHARS),
  ].join("\n");
}

export async function generateConversationTitle(input: ConversationTitleInput) {
  if (process.env.MOCK_LLM === "true") {
    return { title: fallbackTitle(input.userMessage), error: null };
  }

  try {
    const title = await generateTitleWithCodexSubscription(input);
    if (title) {
      return { title, error: null };
    }
    return { title: fallbackTitle(input.userMessage), error: "The title model returned no title." };
  } catch (error) {
    return { title: fallbackTitle(input.userMessage), error: formatErrorMessage(error) };
  }
}

const CODEX_TITLE_MODEL = "gpt-5.6-sol";
const CODEX_TITLE_TIMEOUT_MS = 60_000;

/**
 * Title the conversation through the ChatGPT Codex backend with the
 * credentials the Codex CLI keeps in `~/.codex/auth.json`.
 *
 * Called directly rather than through Mastra: this backend refuses any request
 * that is not `store: false` and streamed, which the generic responses client
 * does not send.
 */
async function generateTitleWithCodexSubscription(input: ConversationTitleInput) {
  if (!readCodexCredentialsSync()) {
    throw new CodexAuthMissingError();
  }
  const creds = await ensureFreshCodexCredentials();
  const response = await fetch("https://chatgpt.com/backend-api/codex/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.accessToken}`,
      "chatgpt-account-id": creds.accountId,
      "OpenAI-Beta": "responses=experimental",
    },
    body: JSON.stringify({
      model: CODEX_TITLE_MODEL,
      instructions: CONVERSATION_TITLE_SYSTEM_PROMPT,
      input: [{ role: "user", content: [{ type: "input_text", text: buildTitleContext(input) }] }],
      store: false,
      stream: true,
    }),
    signal: AbortSignal.timeout(CODEX_TITLE_TIMEOUT_MS),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Codex title request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  let text = "";
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    let event: { type?: string; delta?: unknown };
    try {
      event = JSON.parse(line.slice(5).trim());
    } catch {
      continue;
    }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      text += event.delta;
    }
  }
  return text.trim().replace(/^["'`]+|["'`.]+$/g, "").trim() || null;
}

async function firstConversationUserMessage(runId: string) {
  const first = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(
      eq(messages.runId, runId),
      eq(messages.role, "user"),
      isNull(messages.supersededAt),
      or(
        isNull(messages.kind),
        sql`lower(${messages.kind}) not in ('internal', 'intervention')`,
      ),
    ))
    .orderBy(asc(messages.createdAt), asc(messages.id))
    .get();
  return first?.content.trim() || "";
}

async function generateAndApplyConversationTitle(args: {
  runId: string;
  workerId: string;
  workerType: string;
  assistantReply: string;
  streamCandidateStatus: "missing" | "rejected";
  transcriptCandidateStatus: "not_applicable" | "missing" | "rejected";
}): Promise<ConversationTitleGenerationOutcome> {
  const run = await db.select({
    title: runs.title,
    titleOwnership: runs.titleOwnership,
    titleRevision: runs.titleRevision,
    titleOwnerWorkerId: runs.titleOwnerWorkerId,
  }).from(runs).where(eq(runs.id, args.runId)).get();
  if (
    !run
    || run.titleOwnership !== "automatic"
    || (run.titleOwnerWorkerId && run.titleOwnerWorkerId !== args.workerId)
    || !await isConversationTitleOwningWorker(args.runId, args.workerId)
  ) {
    return "skipped";
  }
  const userMessage = await firstConversationUserMessage(args.runId);
  if (!userMessage || !args.assistantReply.trim()) {
    return "skipped";
  }

  const expectedTitle = buildInitialConversationTitle(userMessage);
  if ((run.title ?? "").trim() !== expectedTitle) {
    return "skipped";
  }

  const result = await generateConversationTitle({
    userMessage,
    assistantReply: args.assistantReply,
  });
  const source = result.error ? "harness_fallback" as const : "harness_llm" as const;
  const updated = await db
    .update(runs)
    .set({
      title: result.title || "New conversation",
      titleSource: source,
      titleRevision: run.titleRevision + 1,
      titleOwnerWorkerId: args.workerId,
      updatedAt: new Date(),
    })
    .where(and(
      eq(runs.id, args.runId),
      eq(runs.title, expectedTitle),
      eq(runs.titleOwnership, "automatic"),
      eq(runs.titleRevision, run.titleRevision),
      or(isNull(runs.titleOwnerWorkerId), eq(runs.titleOwnerWorkerId, args.workerId)),
    ))
    .returning({ id: runs.id, revision: runs.titleRevision })
    .get();

  if (!updated) {
    return "superseded";
  }

  emitNamedEvent({
    kind: "conversation.title_updated",
    runId: args.runId,
    source,
    title: result.title,
    revision: updated.revision,
    workerId: args.workerId,
  });
  notifyEventStreamSubscribers();

  if (result.error) {
    emitNamedEvent({
      kind: "conversation.title_generation_failed",
      runId: args.runId,
      workerId: args.workerId,
      reason: result.error,
      fallbackTitle: result.title,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "conversation.title_generation_failed",
      message: `Conversation title generation failed; using a local fallback: ${result.error}`,
      surface: "log",
      runId: args.runId,
      workerId: args.workerId,
    });
  }

  rememberCompletedTitleGeneration(args.runId);
  return "updated";
}

export function queueConversationTitleGeneration(args: {
  runId: string;
  workerId: string;
  workerType: string;
  assistantReply: string;
  streamCandidateStatus: "missing" | "rejected";
  transcriptCandidateStatus: "not_applicable" | "missing" | "rejected";
}) {
  const existing = titleGenerationInFlight.get(args.runId);
  if (existing) {
    return existing;
  }
  if (completedTitleGenerationRunIds.has(args.runId)) {
    return Promise.resolve("skipped" as const);
  }

  const task = generateAndApplyConversationTitle(args);
  titleGenerationInFlight.set(args.runId, task);
  const release = () => {
    if (titleGenerationInFlight.get(args.runId) === task) {
      titleGenerationInFlight.delete(args.runId);
    }
  };
  void task.then(release, release);
  return task;
}
