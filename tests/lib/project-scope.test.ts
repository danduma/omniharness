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

  it("uses the configured root instead of a stale stored run path after a folder rename", () => {
    const result = resolveProjectScope({
      draftProjectPath: null,
      selectedRunId: "run-1",
      plans: [{ id: "plan-1", path: "/workspace/root/vibes/ad-hoc/2026-04-20.md" }],
      runs: [{ id: "run-1", planId: "plan-1", projectPath: "/workspace/old-name" }],
      explicitProjects: ["/workspace/new-name"],
    });

    expect(result).toBe("/workspace/new-name");
  });

  it("uses the single empty explicit project for stale selected runs after a folder rename", () => {
    const result = resolveProjectScope({
      draftProjectPath: null,
      selectedRunId: "run-opencut-1",
      plans: [
        { id: "plan-1", path: "/Users/masterman/NLP/omniharness/vibes/ad-hoc/2026-04-20.md" },
        { id: "plan-2", path: "/Users/masterman/NLP/omniharness/vibes/ad-hoc/2026-04-21.md" },
        { id: "plan-3", path: "/Users/masterman/NLP/omniharness/vibes/ad-hoc/2026-04-22.md" },
      ],
      runs: [
        { id: "run-opencut-1", planId: "plan-1", projectPath: "/Users/masterman/NLP/opencut" },
        { id: "run-wikinuxt-1", planId: "plan-2", projectPath: "/Users/masterman/NLP/wikinuxt" },
        { id: "run-omni-1", planId: "plan-3", projectPath: "/Users/masterman/NLP/omniharness" },
      ],
      explicitProjects: [
        "/Users/masterman/NLP/wikinuxt",
        "/Users/masterman/NLP/omniharness",
        "/Users/masterman/NLP/directorscut",
      ],
    });

    expect(result).toBe("/Users/masterman/NLP/directorscut");
  });
});
