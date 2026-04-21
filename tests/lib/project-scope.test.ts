import { describe, expect, it } from "vitest";
import { resolveProjectScope } from "@/lib/project-scope";

describe("resolveProjectScope", () => {
  it("prefers the draft project path when starting a new conversation", () => {
    const result = resolveProjectScope({
      draftProjectPath: "/workspace/app",
      selectedRunId: "run-1",
      plans: [{ id: "plan-1", path: "/workspace/other/vibes/plan.md" }],
      runs: [{ id: "run-1", planId: "plan-1", projectPath: null }],
      explicitProjects: ["/workspace/app"],
    });

    expect(result).toBe("/workspace/app");
  });

  it("finds the matching explicit project for an existing run", () => {
    const result = resolveProjectScope({
      draftProjectPath: null,
      selectedRunId: "run-1",
      plans: [{ id: "plan-1", path: "/workspace/app/vibes/plan.md" }],
      runs: [{ id: "run-1", planId: "plan-1", projectPath: null }],
      explicitProjects: ["/workspace/app", "/workspace/other"],
    });

    expect(result).toBe("/workspace/app");
  });

  it("prefers the run project path over the ad hoc plan file location", () => {
    const result = resolveProjectScope({
      draftProjectPath: null,
      selectedRunId: "run-1",
      plans: [{ id: "plan-1", path: "/workspace/root/vibes/ad-hoc/2026-04-20.md" }],
      runs: [{ id: "run-1", planId: "plan-1", projectPath: "/workspace/app" }],
      explicitProjects: ["/workspace/app", "/workspace/other"],
    });

    expect(result).toBe("/workspace/app");
  });
});
