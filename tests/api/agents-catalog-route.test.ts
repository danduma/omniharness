import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

const { mockBuildWorkerModelCatalog, mockIsSpawnableWorkerType } = vi.hoisted(() => ({
  mockBuildWorkerModelCatalog: vi.fn(),
  mockIsSpawnableWorkerType: vi.fn(),
}));

vi.mock("@/server/supervisor/worker-availability", () => ({
  isSpawnableWorkerType: mockIsSpawnableWorkerType,
}));

vi.mock("@/server/worker-models", () => ({
  buildWorkerModelCatalog: mockBuildWorkerModelCatalog,
}));

import { GET } from "@/app/api/agents/catalog/route";

describe("GET /api/agents/catalog", () => {
  beforeEach(() => {
    mockBuildWorkerModelCatalog.mockReset();
    mockBuildWorkerModelCatalog.mockResolvedValue({
      codex: [
        { value: "gpt-5.4", label: "GPT-5.4" },
        { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
      ],
      claude: [
        { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
      ],
      gemini: [
        { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview" },
      ],
      opencode: [
        { value: "openai/gpt-5.4", label: "GPT-5.4" },
      ],
    });
    mockIsSpawnableWorkerType.mockReset();
    return db.delete(settings);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers locally spawnable workers over bridge doctor false negatives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        results: [
          {
            type: "codex",
            status: "error",
            binary: false,
            apiKey: false,
            endpoint: null,
            message: "codex-acp binary not found on PATH",
          },
        ],
      }),
    }));

    mockIsSpawnableWorkerType.mockImplementation((type: string) => (
      type === "codex"
        ? { ok: true, type: "codex" }
        : { ok: false, type, reason: `${type} unavailable` }
    ));

    const response = await GET(new NextRequest("http://localhost/api/agents/catalog"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    const codex = payload.workers.find((worker: { type: string }) => worker.type === "codex");

    expect(payload.diagnostics).toEqual([]);
    expect(codex?.availability.status).toBe("ok");
    expect(codex?.availability.message).toBe("Ready to spawn.");
    expect(payload.workerModels.codex).toEqual(expect.arrayContaining([
      { value: "gpt-5.4", label: "GPT-5.4" },
      { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    ]));
    expect(payload.workerModels.claude).toEqual(expect.arrayContaining([
      { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
    ]));
  });
});
