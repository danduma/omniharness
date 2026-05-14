import { describe, expect, it } from "vitest";
import { shouldSetRequestedMode } from "@/server/agent-runtime/codex";

describe("shouldSetRequestedMode", () => {
  it("does not set a requested mode that the ACP session does not advertise", () => {
    expect(shouldSetRequestedMode("full-access", "implementation", [
      { id: "implementation" },
      { id: "planning" },
      { id: "direct" },
    ])).toBe(false);
  });

  it("sets an advertised requested mode when it differs from the current mode", () => {
    expect(shouldSetRequestedMode("full-access", "read-only", [
      { id: "read-only" },
      { id: "full-access" },
    ])).toBe(true);
  });

  it("preserves mode setting for agents that omit available modes", () => {
    expect(shouldSetRequestedMode("full-access", undefined)).toBe(true);
  });
});
