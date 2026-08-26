import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, runs, settings } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import { CONVERSATION_TITLE_SYSTEM_PROMPT } from "@/server/prompts";
import { formatErrorMessage } from "@/server/runs/failures";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import {
  buildMastraModelConfig,
  getSupervisorModelConfig,
  validateSupervisorModelConfig,
} from "@/server/supervisor/model-config";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";

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
    const allSettings = await db.select().from(settings);
    const { env: envParams, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const env = { ...process.env, ...envParams };
    const config = validateSupervisorModelConfig(
      getSupervisorModelConfig(env),
      decryptionFailures,
    );
    const model = buildMastraModelConfig(config);
    const agent = new Agent({
      id: "omniharness-title-generator",
      name: "OmniHarness Title Generator",
      instructions: CONVERSATION_TITLE_SYSTEM_PROMPT,
      model,
    });

    const completion = await agent.generate(buildTitleContext(input), {
      structuredOutput: {
        schema: z.object({ title: z.string() }),
        model,
        jsonPromptInjection: true,
      },
    });
    const title = completion.object?.title?.trim();
    if (!title) {
      return {
        title: fallbackTitle(input.userMessage),
        error: "The title model returned no title.",
      };
    }

    return { title, error: null };
  } catch (error) {
    return { title: fallbackTitle(input.userMessage), error: formatErrorMessage(error) };
  }
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
  const userMessage = await firstConversationUserMessage(args.runId);
  if (!userMessage || !args.assistantReply.trim()) {
    return "skipped";
  }

  const expectedTitle = buildInitialConversationTitle(userMessage);
  const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, args.runId)).get();
  if (!run || (run.title ?? "").trim() !== expectedTitle) {
    return "skipped";
  }

  emitNamedEvent({
    kind: "conversation.title_sources_missing",
    runId: args.runId,
    workerId: args.workerId,
    workerType: args.workerType,
    streamCandidateStatus: args.streamCandidateStatus,
    transcriptCandidateStatus: args.transcriptCandidateStatus,
    fallback: "harness_llm",
  });

  const result = await generateConversationTitle({
    userMessage,
    assistantReply: args.assistantReply,
  });
  const source = result.error ? "harness_fallback" as const : "harness_llm" as const;
  const updated = await db
    .update(runs)
    .set({ title: result.title || "New conversation", updatedAt: new Date() })
    .where(and(eq(runs.id, args.runId), eq(runs.title, expectedTitle)))
    .returning({ id: runs.id })
    .get();

  if (!updated) {
    return "superseded";
  }

  emitNamedEvent({
    kind: "conversation.title_updated",
    runId: args.runId,
    source,
    title: result.title,
  });

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
