import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFrozenRecentOrder } from "@/app/home/useFrozenRecentOrder";
import type { SidebarGroup } from "@/app/home/types";

const refSlots: Array<{ current: unknown }> = [];
let refIndex = 0;

vi.mock("react", () => ({
  useRef: (initialValue: unknown) => {
    const index = refIndex;
    refIndex += 1;
    if (!refSlots[index]) {
      refSlots[index] = { current: initialValue };
    }
    return refSlots[index];
  },
}));

const useRenderFrozenRecentOrder = (
  groups: SidebarGroup[],
  active: boolean,
): SidebarGroup[] => {
  refIndex = 0;
  return useFrozenRecentOrder(groups, active);
};

function group(path: string, runIds: string[], statusById: Record<string, string> = {}): SidebarGroup {
  return {
    path,
    name: path.split("/").pop() ?? path,
    runs: runIds.map((id) => ({
      id,
      path: `${path}/${id}`,
      title: `Run ${id}`,
      status: statusById[id] ?? "done",
      createdAt: "2026-06-15T10:00:00.000Z",
    })),
  };
}

describe("useFrozenRecentOrder", () => {
  beforeEach(() => {
    refSlots.length = 0;
    refIndex = 0;
  });

  it("keeps Recent tab membership and order fixed while refreshing live rows still present", () => {
    const firstRender = useRenderFrozenRecentOrder(
      [group("/project/a", ["old-unread", "working"], { "old-unread": "done", working: "running" })],
      true,
    );

    expect(firstRender[0].runs.map((run) => run.id)).toEqual(["old-unread", "working"]);

    const secondRender = useRenderFrozenRecentOrder(
      [group("/project/a", ["new-unread", "working"], { "new-unread": "done", working: "done" })],
      true,
    );

    expect(secondRender[0].runs.map((run) => run.id)).toEqual(["old-unread", "working"]);
    expect(secondRender[0].runs.find((run) => run.id === "working")?.status).toBe("done");
  });

  it("captures a fresh Recent tab snapshot after leaving and returning", () => {
    useRenderFrozenRecentOrder([group("/project/a", ["old-unread"])], true);
    useRenderFrozenRecentOrder([group("/project/a", ["old-unread"])], false);

    const reopened = useRenderFrozenRecentOrder([group("/project/a", ["new-unread"])], true);

    expect(reopened[0].runs.map((run) => run.id)).toEqual(["new-unread"]);
  });

  it("does not add new groups or remove snapshotted groups while Recent stays open", () => {
    useRenderFrozenRecentOrder([group("/project/a", ["old-unread"])], true);

    const updated = useRenderFrozenRecentOrder([group("/project/b", ["new-unread"])], true);

    expect(updated.map((project) => project.path)).toEqual(["/project/a"]);
    expect(updated[0].runs.map((run) => run.id)).toEqual(["old-unread"]);
  });
});
