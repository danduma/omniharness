import { describe, expect, it, vi } from "vitest";
import { buildWorkerModelCatalog, mergeClaudeGatewayModelsIntoCatalog, WorkerModelCatalogManager } from "@/server/worker-models";
import type { WorkerModelCatalog } from "@/server/worker-models";

describe("worker model catalog", () => {
  it("adds encoded gateway models after native Claude models without duplicates", async () => {
    const catalog = await buildWorkerModelCatalog({ runCommand: async () => "" });
    const merged = mergeClaudeGatewayModelsIntoCatalog(catalog, {
      custom: [
        { id: "gpt-5.6-sol", label: "GPT-5.6 SOL" },
        { id: "team/custom", label: "Team Custom" },
      ],
      discovered: [
        { id: "gpt-5.6-sol", label: "Duplicate" },
        { id: "new/model" },
      ],
    });
    expect(merged.claude.slice(0, catalog.claude.length)).toEqual(catalog.claude);
    expect(merged.claude.slice(catalog.claude.length)).toEqual([
      { value: "cliproxyapi:gpt-5.6-sol", label: "GPT-5.6 SOL" },
      { value: "cliproxyapi:team/custom", label: "Team Custom" },
      { value: "cliproxyapi:new/model", label: "new/model" },
    ]);
    expect(catalog.claude.some((model) => model.value.startsWith("cliproxyapi:"))).toBe(false);
  });

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
      { value: "gemini-3", label: "Gemini 3" },
      { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    ]);
  });

  it("orders Codex models by capability priority with GPT-5.6 Sol first", async () => {
    const catalog = await buildWorkerModelCatalog({
      runCommand: async (command, args) => {
        if (command === "codex" && args.join(" ") === "debug models") {
          return JSON.stringify({
            models: [
              { slug: "gpt-5.5", display_name: "GPT-5.5", priority: 7, visibility: "list" },
              { slug: "codex-auto-review", display_name: "Codex Auto Review", priority: 0, visibility: "hide" },
              { slug: "gpt-5.6-luna", display_name: "GPT-5.6-Luna", priority: 3, visibility: "list" },
              { slug: "gpt-5.6-sol", display_name: "GPT-5.6-Sol", priority: 1, visibility: "list" },
              { slug: "gpt-5.6-terra", display_name: "GPT-5.6-Terra", priority: 2, visibility: "list" },
            ],
          });
        }
        return "";
      },
    });

    expect(catalog.codex.slice(0, 4)).toEqual([
      { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
      { value: "gpt-5.5", label: "GPT-5.5" },
    ]);
    expect(catalog.codex.some((model) => model.value === "codex-auto-review")).toBe(false);
  });

  it("uses GPT-5.6 Sol as the first Codex fallback when discovery is unavailable", async () => {
    const catalog = await buildWorkerModelCatalog({ runCommand: async () => "" });

    expect(catalog.codex.slice(0, 3)).toEqual([
      { value: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
      { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
    ]);
  });

  it("offers Claude Opus 5 as the default Claude Code model", async () => {
    const catalog = await buildWorkerModelCatalog({
      runCommand: async () => "",
    });

    expect(catalog.claude.slice(0, 4)).toEqual([
      { value: "claude-opus-5", label: "Opus 5" },
      { value: "claude-fable-5-1", label: "Fable 5.1" },
      { value: "claude-fable-5", label: "Fable 5" },
      { value: "claude-opus-4-8", label: "Opus 4.8" },
    ]);
  });

  it("drops the Claude vendor prefix from cached labels", async () => {
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: async () => ({
        claude: [{ value: "claude-opus-4-9", label: "Claude Opus 4.9" }],
      }),
      runCommand: async () => "",
    });

    const snapshot = await manager.getCatalogSnapshot();

    expect(snapshot.catalog.claude).toEqual(expect.arrayContaining([
      { value: "claude-opus-4-9", label: "Opus 4.9" },
    ]));
  });

  // The cache is arbitrary JSON out of the settings table, so a stored entry may
  // carry no label at all and the manager has to derive one from the id.
  const unlabelledCache = (values: string[]) => async () => ({
    claude: values.map((value) => ({ value })),
  } as unknown as Partial<WorkerModelCatalog>);

  it("rejoins hyphenated version segments when deriving a label", async () => {
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: unlabelledCache([
        "claude-fable-5-2",
        "claude-opus-4-9",
        "claude-opus-6",
        "claude-haiku-4-9-20260101",
      ]),
      runCommand: async () => "",
    });

    const snapshot = await manager.getCatalogSnapshot();

    expect(snapshot.catalog.claude).toEqual(expect.arrayContaining([
      { value: "claude-fable-5-2", label: "Fable 5.2" },
      { value: "claude-opus-4-9", label: "Opus 4.9" },
      { value: "claude-opus-6", label: "Opus 6" },
      // The snapshot date is not a version component, so it stays a separate word.
      { value: "claude-haiku-4-9-20260101", label: "Haiku 4.9 20260101" },
    ]));
  });

  it("leaves a four-digit year out of the version join", async () => {
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: async () => ({
        opencode: [{ value: "google/deep-research-preview-04-2026" }],
      } as unknown as Partial<WorkerModelCatalog>),
      runCommand: async () => "",
    });

    const snapshot = await manager.getCatalogSnapshot();

    expect(snapshot.catalog.opencode).toEqual(expect.arrayContaining([
      { value: "google/deep-research-preview-04-2026", label: "Deep Research Preview 04 2026" },
    ]));
  });

  it("keeps the vendor prefix when no word follows it", async () => {
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: unlabelledCache(["claude-3"]),
      runCommand: async () => "",
    });

    const snapshot = await manager.getCatalogSnapshot();

    expect(snapshot.catalog.claude).toEqual(expect.arrayContaining([
      { value: "claude-3", label: "Claude 3" },
    ]));
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

  it("filters deprecated Gemini models from cached catalogs", async () => {
    const manager = new WorkerModelCatalogManager({
      loadCachedCatalog: async () => ({
        gemini: [
          { value: "gemini-3.5-flash", label: "Gemini 3.1 Pro Preview" },
          { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
        ],
      }),
      runCommand: async () => "",
    });

    const snapshot = await manager.getCatalogSnapshot();

    expect(snapshot.catalog.gemini).toEqual([
      { value: "gemini-3", label: "Gemini 3" },
      { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    ]);
  });
});
