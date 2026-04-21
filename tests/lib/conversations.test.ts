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
          status: "running",
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
      path: "vibes/ad-hoc/2026-04-20T14-34-11.md",
    });
  });

  it('falls back to "Other Conversations" and "New conversation" when metadata is absent', () => {
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

    expect(result[0]?.name).toBe("Other Conversations");
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
});
