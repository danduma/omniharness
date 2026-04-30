import { Agent } from "@mastra/core/agent";
import { z } from "zod";
import { db } from "@/server/db";
import { executionEvents, runs, settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CONVERSATION_TITLE_SYSTEM_PROMPT } from "@/server/prompts";
import { formatErrorMessage } from "@/server/runs/failures";
import { hydrateRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";
import {
  buildMastraModelConfig,
  getSupervisorModelConfig,
  validateSupervisorModelConfig,
} from "@/server/supervisor/model-config";

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

export async function generateConversationTitle(command: string) {
  if (process.env.MOCK_LLM === "true") {
    return { title: fallbackTitle(command), error: null };
  }

  try {
    const allSettings = await db.select().from(settings);
    const { env: envParams, decryptionFailures } = hydrateRuntimeEnvFromSettings(allSettings);
    const env = { ...process.env, ...envParams };
    const config = validateSupervisorModelConfig(
      getSupervisorModelConfig(env),
      decryptionFailures,
    );
    const agent = new Agent({
      id: "omniharness-title-generator",
      name: "OmniHarness Title Generator",
      instructions: CONVERSATION_TITLE_SYSTEM_PROMPT,
      model: buildMastraModelConfig(config),
    });

    const completion = await agent.generate(command, {
      structuredOutput: {
        schema: z.object({
          title: z.string(),
        }),
      },
    });

    if (!completion.object?.title) {
      return { title: fallbackTitle(command), error: null };
    }

    return { title: (completion.object.title || fallbackTitle(command)).trim(), error: null };
  } catch (error) {
    return { title: fallbackTitle(command), error: formatErrorMessage(error) };
  }
}

export async function queueConversationTitleGeneration(args: { runId: string; command: string }) {
  const result = await generateConversationTitle(args.command);

  await db
    .update(runs)
    .set({
      title: result.title || "New conversation",
      updatedAt: new Date(),
    })
    .where(eq(runs.id, args.runId));

  if (result.error) {
    await db.insert(executionEvents).values({
      id: randomUUID(),
      runId: args.runId,
      workerId: null,
      planItemId: null,
      eventType: "conversation_title_generation_failed",
      details: JSON.stringify({
        summary: "Conversation title generation failed; using fallback title.",
        error: result.error,
      }),
      createdAt: new Date(),
    });
  }
}
