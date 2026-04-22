import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFileSync } = vi.hoisted(() => ({
  mockExecFileSync: vi.fn(),
}));

vi.mock("child_process", () => ({
  execFileSync: mockExecFileSync,
}));

describe("selectSpawnableWorkerType", () => {
  beforeEach(() => {
    mockExecFileSync.mockReset();
  });

  it("uses the requested worker type when it is spawnable", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "gemini") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("gemini", { GEMINI_API_KEY: "key" })).toEqual({
      type: "gemini",
      requestedType: "gemini",
      fallbackReason: null,
    });
  });

  it("falls back when the requested worker binary is unavailable", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "opencode") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("claude-code", { OPENAI_API_KEY: "key" })).toEqual({
      type: "opencode",
      requestedType: "claude",
      fallbackReason: "claude worker binary is not installed.",
    });
  });

  it("accepts codex when the ACP adapter is available even without OPENAI_API_KEY", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex-acp") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {})).toEqual({
      type: "codex",
      requestedType: "codex",
      fallbackReason: null,
    });
  });

  it("falls back from codex when only the MCP-only codex binary is installed", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "codex" || args[0] === "opencode") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("codex", {})).toEqual({
      type: "opencode",
      requestedType: "codex",
      fallbackReason: "codex ACP adapter is not installed.",
    });
  });

  it("accepts claude when the ACP adapter is available even without Anthropic env vars", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "claude-agent-acp") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("claude", {})).toEqual({
      type: "claude",
      requestedType: "claude",
      fallbackReason: null,
    });
  });

  it("accepts gemini when the CLI is available even without GEMINI_API_KEY", async () => {
    mockExecFileSync.mockImplementation((command: string, args: string[]) => {
      if (args[0] === "gemini") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("gemini", {})).toEqual({
      type: "gemini",
      requestedType: "gemini",
      fallbackReason: null,
    });
  });

  it("throws an actionable error when nothing spawnable is available", async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(() => selectSpawnableWorkerType("claude-code", {})).toThrow(/No spawnable worker is available/i);
  });
});
