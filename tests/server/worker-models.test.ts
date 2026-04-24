import { describe, expect, it } from "vitest";
import { buildWorkerModelCatalog } from "@/server/worker-models";

describe("worker model catalog", () => {
  it("keeps hardcoded models and adds newly discovered Codex and OpenCode models", async () => {
    const catalog = await buildWorkerModelCatalog({
      runCommand: async (command, args) => {
        if (command === "codex" && args.join(" ") === "debug models") {
          return JSON.stringify({
            models: [
              { slug: "gpt-5.4", display_name: "GPT-5.4" },
              { slug: "gpt-5.5", display_name: "GPT-5.5" },
            ],
          });
        }

        if (command === "opencode" && args.join(" ") === "models --refresh") {
          return [
            "openai/gpt-5.4",
            "openai/gpt-5.5",
            "anthropic/claude-sonnet-4",
          ].join("\n");
        }

        return "";
      },
    });

    expect(catalog.codex.map((model) => model.value)).toEqual(expect.arrayContaining([
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5",
    ]));
    expect(catalog.opencode.map((model) => model.value)).toEqual(expect.arrayContaining([
      "openai/gpt-5.4",
      "openai/gpt-5.4-mini",
      "openai/gpt-5.5",
      "anthropic/claude-sonnet-4",
    ]));
    expect(catalog.gemini).toEqual([
      { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
    ]);
  });
});
