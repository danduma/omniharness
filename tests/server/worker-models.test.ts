import { describe, expect, it, vi } from "vitest";
import { buildWorkerModelCatalog, WorkerModelCatalogManager } from "@/server/worker-models";

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

  it("returns the cached catalog immediately while refreshing models in the background", async () => {
    let resolveCodexModels: (output: string) => void = () => {};
    let resolveOpenCodeModels: (output: string) => void = () => {};
    const codexModels = new Promise<string>((resolve) => {
      resolveCodexModels = resolve;
    });
    const openCodeModels = new Promise<string>((resolve) => {
      resolveOpenCodeModels = resolve;
    });
    const saveCachedCatalog = vi.fn();
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: async () => ({
        codex: [
          { value: "gpt-5.5", label: "GPT-5.5" },
        ],
        opencode: [
          { value: "openai/gpt-5.5", label: "GPT-5.5" },
        ],
      }),
      saveCachedCatalog,
      runCommand: async (command, args) => {
        if (command === "codex" && args.join(" ") === "debug models") {
          return codexModels;
        }

        if (command === "opencode" && args.join(" ") === "models --refresh") {
          return openCodeModels;
        }

        return "";
      },
    });

    const snapshot = await manager.getCatalogSnapshot({ refreshOnFirstLoad: true });

    expect(snapshot.refreshing).toBe(true);
    expect(snapshot.catalog.codex).toEqual(expect.arrayContaining([
      { value: "gpt-5.5", label: "GPT-5.5" },
    ]));
    expect(snapshot.catalog.opencode).toEqual(expect.arrayContaining([
      { value: "openai/gpt-5.5", label: "GPT-5.5" },
    ]));
    expect(saveCachedCatalog).not.toHaveBeenCalled();

    resolveCodexModels(JSON.stringify({
      models: [
        { slug: "gpt-5.6", display_name: "GPT-5.6" },
      ],
    }));
    resolveOpenCodeModels("openai/gpt-5.6");

    const refreshedCatalog = await manager.refreshCatalog();

    expect(refreshedCatalog.codex).toEqual(expect.arrayContaining([
      { value: "gpt-5.6", label: "GPT-5.6" },
    ]));
    expect(saveCachedCatalog).toHaveBeenCalledWith(refreshedCatalog);
  });
});
