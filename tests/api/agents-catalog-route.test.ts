import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

const { mockIsSpawnableWorkerType } = vi.hoisted(() => ({
  mockIsSpawnableWorkerType: vi.fn(),
}));

vi.mock("@/server/supervisor/worker-availability", () => ({
  isSpawnableWorkerType: mockIsSpawnableWorkerType,
}));

import { GET } from "@/app/api/agents/catalog/route";

describe("GET /api/agents/catalog", () => {
  beforeEach(() => {
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

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = await response.json();
    const codex = payload.workers.find((worker: { type: string }) => worker.type === "codex");

    expect(payload.diagnostics).toEqual([]);
    expect(codex?.availability.status).toBe("ok");
    expect(codex?.availability.message).toBe("Ready to spawn.");
  });
});
