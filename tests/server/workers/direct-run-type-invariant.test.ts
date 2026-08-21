import { describe, expect, it, vi } from "vitest";
import { assertDirectRunWorkerTypeInvariant, DirectRunHandoffRequiredError } from "@/server/workers/direct-run-type-invariant";

describe("direct run worker type invariant", () => {
  it("requires a handoff before another CLI can be inserted into a direct run", () => {
    const emit = vi.fn();
    expect(() => assertDirectRunWorkerTypeInvariant({
      run: { id: "run-1", sessionType: "omni", mode: "direct" },
      existingWorkerTypes: ["codex"],
      requestedWorkerType: "claude",
      emit,
    })).toThrow(DirectRunHandoffRequiredError);
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ kind: "handoff.refused", code: "handoff_required" }));
  });

  it("allows same-CLI recreation and implementation multi-worker runs", () => {
    expect(() => assertDirectRunWorkerTypeInvariant({ run: { id: "direct", sessionType: "omni", mode: "direct" }, existingWorkerTypes: ["codex"], requestedWorkerType: "codex" })).not.toThrow();
    expect(() => assertDirectRunWorkerTypeInvariant({ run: { id: "implementation", sessionType: "omni", mode: "implementation" }, existingWorkerTypes: ["codex"], requestedWorkerType: "claude" })).not.toThrow();
  });
});
