import { describe, expect, it } from "vitest";
import { buildConversationGroups } from "@/lib/conversations";

describe("buildConversationGroups", () => {
  it("groups runs under their stored project path and uses run titles", () => {
    const result = buildConversationGroups({
      explicitProjects: ["/workspace/app"],
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" }],
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          mode: "implementation",
          status: "running",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: "/workspace/app",
          title: "Fix Search Layout",
          preferredWorkerType: "codex",
        },
      ],
    });

    expect(result[0]).toMatchObject({
      path: "/workspace/app",
      name: "app",
    });
    expect(result[0]?.runs[0]).toMatchObject({
      id: "run-1",
      title: "Fix Search Layout",
      path: "vibes/ad-hoc/2026-04-20T14-34-11.md",
      mode: "implementation",
      preferredWorkerType: "codex",
    });
  });

  it('falls back to "Other sessions" and "New conversation" when metadata is absent', () => {
    const result = buildConversationGroups({
      explicitProjects: [],
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" }],
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "running",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: null,
          title: null,
        },
      ],
    });

    expect(result[0]?.name).toBe("Other sessions");
    expect(result[0]?.runs[0]?.title).toBe("New conversation");
  });

  it("keeps persisted project-scoped runs under their folder even before explicit project settings hydrate", () => {
    const result = buildConversationGroups({
      explicitProjects: [],
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" }],
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "done",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: "/workspace/app",
          title: "Fix Search Layout",
        },
      ],
    });

    expect(result[0]).toMatchObject({
      path: "/workspace/app",
      name: "app",
    });
    expect(result[0]?.runs[0]).toMatchObject({
      id: "run-1",
      title: "Fix Search Layout",
    });
    expect(result.some((group) => group.path === "other")).toBe(false);
  });

  it("treats stale stored project paths as the configured root after a project folder rename", () => {
    const result = buildConversationGroups({
      explicitProjects: ["/workspace/new-name"],
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" }],
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "done",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: "/workspace/old-name",
          title: "Fix Search Layout",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      path: "/workspace/new-name",
      name: "new-name",
    });
    expect(result[0]?.runs[0]).toMatchObject({
      id: "run-1",
      title: "Fix Search Layout",
    });
  });

  it("does not resurrect removed project folders when multiple explicit roots are configured", () => {
    const result = buildConversationGroups({
      explicitProjects: ["/workspace/new-name", "/workspace/other"],
      plans: [{ id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" }],
      runs: [
        {
          id: "run-1",
          planId: "plan-1",
          status: "done",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: "/workspace/old-name",
          title: "Fix Search Layout",
        },
      ],
    });

    expect(result.map((group) => group.path)).toEqual([
      "/workspace/new-name",
      "/workspace/other",
      "other",
    ]);
    expect(result.find((group) => group.path === "/workspace/old-name")).toBeUndefined();
    expect(result.find((group) => group.path === "other")?.runs[0]?.id).toBe("run-1");
  });

  it("moves stale runs to the single empty explicit project after a folder rename", () => {
    const result = buildConversationGroups({
      explicitProjects: [
        "/Users/masterman/NLP/wikinuxt",
        "/Users/masterman/NLP/omniharness",
        "/Users/masterman/NLP/directorscut",
      ],
      plans: [
        { id: "plan-1", path: "vibes/ad-hoc/2026-04-20T14-34-11.md" },
        { id: "plan-2", path: "vibes/ad-hoc/2026-04-21T14-34-11.md" },
        { id: "plan-3", path: "vibes/ad-hoc/2026-04-22T14-34-11.md" },
      ],
      runs: [
        {
          id: "run-opencut-1",
          planId: "plan-1",
          status: "done",
          createdAt: "2026-04-20T14:34:11.000Z",
          projectPath: "/Users/masterman/NLP/opencut",
          title: "Old direct session",
        },
        {
          id: "run-wikinuxt-1",
          planId: "plan-2",
          status: "done",
          createdAt: "2026-04-21T14:34:11.000Z",
          projectPath: "/Users/masterman/NLP/wikinuxt",
          title: "Wiki session",
        },
        {
          id: "run-omni-1",
          planId: "plan-3",
          status: "done",
          createdAt: "2026-04-22T14:34:11.000Z",
          projectPath: "/Users/masterman/NLP/omniharness",
          title: "Omni session",
        },
      ],
    });

    expect(result.find((group) => group.path === "/Users/masterman/NLP/opencut")).toBeUndefined();
    expect(result.find((group) => group.path === "other")).toBeUndefined();
    expect(result.find((group) => group.path === "/Users/masterman/NLP/directorscut")?.runs.map((run) => run.id)).toEqual([
      "run-opencut-1",
    ]);
  });
});
