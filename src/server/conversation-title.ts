import { TokenJS } from "token.js";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { eq } from "drizzle-orm";

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
    return fallbackTitle(command);
  }

  try {
    const completion = await tokenjs.chat.completions.create({
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Generate a concise title for a coding conversation. Return it only via the provided tool. Keep it to 2-6 words, title case, and never use ISO timestamps or markdown filenames.",
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
      return fallbackTitle(command);
    }

    const args = JSON.parse(toolCall.function.arguments) as { title?: string };
    return (args.title || fallbackTitle(command)).trim();
  } catch {
    return fallbackTitle(command);
  }
}

export async function queueConversationTitleGeneration(args: { runId: string; command: string }) {
  const title = await generateConversationTitle(args.command);

  await db
    .update(runs)
    .set({
      title: title || "New conversation",
      updatedAt: new Date(),
    })
    .where(eq(runs.id, args.runId));
}
