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
      if (args[0] === "codex") {
        return Buffer.from("");
      }
      throw new Error("not found");
    });

    const { selectSpawnableWorkerType } = await import("@/server/supervisor/worker-availability");

    expect(selectSpawnableWorkerType("claude-code", { OPENAI_API_KEY: "key" })).toEqual({
      type: "codex",
      requestedType: "claude",
      fallbackReason: "claude worker binary is not installed.",
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
