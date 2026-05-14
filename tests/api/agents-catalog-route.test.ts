import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

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

import { GET } from "@/app/api/agents/catalog/route";

describe("GET /api/agents/catalog", () => {
  beforeEach(() => {
    mockGetCatalogSnapshot.mockReset();
    mockGetCatalogSnapshot.mockResolvedValue({
      catalog: {
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
      },
      refreshing: true,
    });
    mockIsSpawnableWorkerType.mockReset();
    mockGetWorkerAuthenticationInfo.mockReset();
    mockGetWorkerAuthenticationInfo.mockImplementation((type: string) => ({
      status: "authenticated",
      method: "session_file",
      message: `${type} signed in.`,
      setupCommand: `${type} login`,
    }));
    mockGetWorkerInstallationInfo.mockReset();
    mockGetWorkerInstallationInfo.mockImplementation((type: string) => ({
      command: type === "codex" ? "codex-acp" : type,
      path: `/opt/omni/bin/${type}`,
      dir: "/opt/omni/bin",
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
    expect(codex?.authentication).toMatchObject({
      status: "authenticated",
      setupCommand: "codex login",
    });
    expect(codex?.installation).toEqual({
      command: "codex-acp",
      path: "/opt/omni/bin/codex",
      dir: "/opt/omni/bin",
    });
    expect(payload.workerModels.codex).toEqual(expect.arrayContaining([
      { value: "gpt-5.4", label: "GPT-5.4" },
      { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
    ]));
    expect(payload.workerModels.claude).toEqual(expect.arrayContaining([
      { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
    ]));
  });

  it("downgrades an installed worker when CLI authentication is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ results: [] }),
    }));

    mockIsSpawnableWorkerType.mockImplementation((type: string) => (
      type === "codex"
        ? { ok: true, type: "codex" }
        : { ok: false, type, reason: `${type} unavailable` }
    ));
    mockGetWorkerAuthenticationInfo.mockImplementation((type: string) => (
      type === "codex"
        ? {
          status: "not_authenticated",
          method: "missing",
          message: "Codex CLI is not logged in. Run `codex login`.",
          setupCommand: "codex login",
        }
        : {
          status: "unknown",
          method: "unknown",
          message: "Authentication could not be verified.",
          setupCommand: `${type} auth login`,
        }
    ));

    const response = await GET(new NextRequest("http://localhost/api/agents/catalog"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    const codex = payload.workers.find((worker: { type: string }) => worker.type === "codex");

    expect(codex?.availability.status).toBe("warning");
    expect(codex?.availability.binary).toBe(true);
    expect(codex?.availability.message).toContain("codex login");
    expect(codex?.authentication).toMatchObject({
      status: "not_authenticated",
      setupCommand: "codex login",
    });
  });

  it("returns cached worker availability with a diagnostic when the runtime doctor is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("doctor unavailable")));

    mockIsSpawnableWorkerType.mockImplementation((type: string) => (
      type === "codex"
        ? { ok: true, type: "codex" }
        : { ok: false, type, reason: `${type} unavailable` }
    ));

    const response = await GET(new NextRequest("http://localhost/api/agents/catalog"));
    expect(response.status).toBe(200);

    const payload = await response.json();
    const codex = payload.workers.find((worker: { type: string }) => worker.type === "codex");

    expect(payload.diagnostics).toEqual([
      expect.objectContaining({
        source: "Agent runtime",
        action: "Load worker availability",
        message: "doctor unavailable",
      }),
    ]);
    expect(codex?.availability.status).toBe("ok");
    expect(payload.workerModels.codex).toEqual(expect.arrayContaining([
      { value: "gpt-5.4", label: "GPT-5.4" },
    ]));
  });
});
