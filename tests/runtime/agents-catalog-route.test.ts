import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";

const { mockGetCatalogSnapshot, mockGetWorkerAuthenticationInfo, mockGetWorkerInstallationInfo, mockGetWorkerTokenQuotaInfo, mockIsSpawnableWorkerType } = vi.hoisted(() => ({
  mockGetCatalogSnapshot: vi.fn(),
  mockGetWorkerAuthenticationInfo: vi.fn(),
  mockGetWorkerInstallationInfo: vi.fn(),
  mockGetWorkerTokenQuotaInfo: vi.fn(),
  mockIsSpawnableWorkerType: vi.fn(),
}));

vi.mock("@/server/supervisor/worker-availability", () => ({
  getWorkerAuthenticationInfo: mockGetWorkerAuthenticationInfo,
  getWorkerInstallationInfo: mockGetWorkerInstallationInfo,
  getWorkerTokenQuotaInfo: mockGetWorkerTokenQuotaInfo,
  isSpawnableWorkerType: mockIsSpawnableWorkerType,
}));

vi.mock("@/server/worker-models", () => ({
  WorkerModelCatalogManager: vi.fn().mockImplementation(() => ({
    getCatalogSnapshot: mockGetCatalogSnapshot,
  })),
}));

import { handleAgentsCatalogRequest } from "@/runtime/http/routes/agents-catalog";

describe("portable GET /api/agents/catalog", () => {
  beforeEach(() => {
    mockGetCatalogSnapshot.mockReset();
    mockGetCatalogSnapshot.mockResolvedValue({
      catalog: {
        codex: [
          { value: "gpt-5.4", label: "GPT-5.4" },
        ],
      },
      refreshing: false,
    });
    mockGetWorkerAuthenticationInfo.mockReset();
    mockGetWorkerAuthenticationInfo.mockImplementation((type: string) => ({
      status: type === "codex" ? "authenticated" : "unknown",
      method: "session_file",
      message: `${type} signed in.`,
      setupCommand: `${type} login`,
    }));
    mockGetWorkerInstallationInfo.mockReset();
    mockGetWorkerInstallationInfo.mockImplementation((type: string) => ({
      command: type === "codex" ? "codex-acp" : type,
      path: type === "codex" ? "/opt/omni/bin/codex" : null,
      dir: type === "codex" ? "/opt/omni/bin" : null,
    }));
    mockGetWorkerTokenQuotaInfo.mockReset();
    mockGetWorkerTokenQuotaInfo.mockReturnValue({
      status: "unknown",
      source: "test",
      message: "Quota unavailable.",
      remainingTokens: null,
      monthlyLimitTokens: null,
      usedTokens: null,
      resetAt: null,
    });
    mockIsSpawnableWorkerType.mockReset();
    mockIsSpawnableWorkerType.mockImplementation((type: string) => (
      type === "codex"
        ? { ok: true, type: "codex" }
        : { ok: false, type, reason: `${type} unavailable` }
    ));
    return db.delete(settings);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serves worker availability and cached models from a Fetch-compatible handler", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
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

    const response = await handleAgentsCatalogRequest(
      new Request("http://localhost/api/agents/catalog"),
      { surface: "test" },
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    const codex = payload.workers.find((worker: { type: string }) => worker.type === "codex");

    expect(payload.workerModels.codex).toEqual([{ value: "gpt-5.4", label: "GPT-5.4" }]);
    expect(codex.availability).toMatchObject({
      type: "codex",
      status: "ok",
      binary: true,
      message: "Ready to spawn.",
    });
  });

  it("mounts worker availability in the shared runtime registry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [] }),
    }));
    const registry = createOmniRuntimeHttpRegistry();

    const response = await registry.handle(
      new Request("http://localhost/api/agents/catalog"),
      { surface: "test" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      workerModels: expect.objectContaining({
        codex: [{ value: "gpt-5.4", label: "GPT-5.4" }],
      }),
    }));
  });
});
