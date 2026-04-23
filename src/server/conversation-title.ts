import { TokenJS } from "token.js";
import { db } from "@/server/db";
import { executionEvents, runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { CONVERSATION_TITLE_SYSTEM_PROMPT } from "@/server/prompts";
import { formatErrorMessage } from "@/server/runs/failures";

const tokenjs = new TokenJS();

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
    const completion = await tokenjs.chat.completions.create({
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: CONVERSATION_TITLE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: command,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "conversation_title_set",
            description: "Set the human-readable title for the conversation.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
              },
              required: ["title"],
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "conversation_title_set" },
      },
    });

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return { title: fallbackTitle(command), error: null };
    }

    const args = JSON.parse(toolCall.function.arguments) as { title?: string };
    return { title: (args.title || fallbackTitle(command)).trim(), error: null };
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
