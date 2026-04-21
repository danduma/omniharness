import { describe, expect, it } from "vitest";
import { normalizeWorkerType } from "@/server/supervisor/worker-types";

describe("normalizeWorkerType", () => {
  it("maps common claude aliases to the bridge-supported claude type", () => {
    expect(normalizeWorkerType("claude-code")).toBe("claude");
    expect(normalizeWorkerType("claude_code")).toBe("claude");
    expect(normalizeWorkerType("ClaudeCode")).toBe("claude");
  });

  it("maps common codex aliases to the bridge-supported codex type", () => {
    expect(normalizeWorkerType("codex-acp")).toBe("codex");
    expect(normalizeWorkerType("codex-cli")).toBe("codex");
  });

  it("passes already-supported types through", () => {
    expect(normalizeWorkerType("gemini")).toBe("gemini");
    expect(normalizeWorkerType("opencode")).toBe("opencode");
  });
});
