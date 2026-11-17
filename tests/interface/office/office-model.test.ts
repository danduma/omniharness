import { describe, expect, it } from "vitest";
import type { AgentActivity } from "@/interface/office/deriveAgentActivity";
import {
  buildOfficeLayout,
  OFFICE_COLLAPSE_THRESHOLD,
  OFFICE_MAX_ANIMATED,
  OFFICE_MAX_WORKERS,
} from "@/interface/office/office-model";
import {
  accessoryForAgentType,
  AVATAR_HEIGHT,
  AVATAR_WIDTH,
  buildProceduralAvatar,
} from "@/interface/office/procedural-avatar";
import { OfficeViewManager, WORKERS_VIEW_MODE_STORAGE_KEY } from "@/interface/office/OfficeViewManager";
import { focusConversationComposer } from "@/interface/office/focus-composer";

function seats(activities: AgentActivity[]) {
  return activities.map((activity, index) => ({
    worker: { id: `w${index}`, runId: "run-1", type: "codex", status: "working", workerNumber: index + 1 },
    activity,
  }));
}

describe("buildOfficeLayout", () => {
  it("keeps desk order stable and numbers desks from the worker record", () => {
    const layout = buildOfficeLayout(seats(["idle", "writing", "waiting_user"]));
    expect(layout.kind).toBe("office");
    if (layout.kind !== "office") return;
    expect(layout.seats.map((seat) => seat.worker.id)).toEqual(["w0", "w1", "w2"]);
    expect(layout.seats.map((seat) => seat.displayNumber)).toEqual([1, 2, 3]);
    expect(layout.breakRoom).toEqual([]);
  });

  it("spends the animation budget on attention first, then active work, never on resting desks", () => {
    const activities: AgentActivity[] = [
      ...Array.from({ length: 6 }, () => "writing" as const),
      "idle",
      "done",
      "waiting_user",
      "blocked",
      ...Array.from({ length: 4 }, () => "researching" as const),
    ];
    const layout = buildOfficeLayout(seats(activities));
    if (layout.kind !== "office") throw new Error("expected office");
    const animated = layout.seats.filter((seat) => seat.animate);
    expect(animated).toHaveLength(OFFICE_MAX_ANIMATED);
    // Both attention desks win a slot; the budget then runs out before the later researchers.
    expect(layout.seats.filter((seat) => seat.attention).every((seat) => seat.animate)).toBe(true);
    expect(layout.seats.filter((seat) => seat.activity === "researching").some((seat) => seat.animate)).toBe(false);
    expect(layout.seats.filter((seat) => seat.activity === "idle" || seat.activity === "done").every((seat) => !seat.animate)).toBe(true);
  });

  it("moves resting workers to the break room above the collapse threshold", () => {
    const activities: AgentActivity[] = Array.from({ length: OFFICE_COLLAPSE_THRESHOLD + 5 }, (_, index) => (index % 2 === 0 ? "idle" : "writing"));
    const layout = buildOfficeLayout(seats(activities));
    if (layout.kind !== "office") throw new Error("expected office");
    expect(layout.seats.every((seat) => seat.activity === "writing")).toBe(true);
    expect(layout.breakRoom.every((seat) => seat.activity === "idle")).toBe(true);
    expect(layout.seats.length + layout.breakRoom.length).toBe(OFFICE_COLLAPSE_THRESHOLD + 5);
  });

  it("falls back to the strip above the worker ceiling", () => {
    expect(buildOfficeLayout(seats(Array.from({ length: OFFICE_MAX_WORKERS + 1 }, () => "working" as const))).kind).toBe("strip");
  });
});

describe("buildProceduralAvatar", () => {
  it("is deterministic for a seed and varies across seeds", () => {
    expect(buildProceduralAvatar("worker-a", "codex")).toEqual(buildProceduralAvatar("worker-a", "codex"));
    const variants = new Set(["a", "b", "c", "d", "e", "f"].map((seed) => JSON.stringify(buildProceduralAvatar(seed).colors)));
    expect(variants.size).toBeGreaterThan(1);
  });

  it("stays inside the sprite bounds", () => {
    const avatar = buildProceduralAvatar("bounds", "claude");
    expect(avatar.pixels.length).toBeGreaterThan(0);
    for (const pixel of avatar.pixels) {
      expect(pixel.x).toBeGreaterThanOrEqual(0);
      expect(pixel.x).toBeLessThan(AVATAR_WIDTH);
      expect(pixel.y).toBeGreaterThanOrEqual(0);
      expect(pixel.y).toBeLessThan(AVATAR_HEIGHT);
    }
  });

  it("encodes agent type as an accessory shape", () => {
    expect(accessoryForAgentType("codex")).toBe("glasses");
    expect(accessoryForAgentType("Claude")).toBe("headphones");
    expect(accessoryForAgentType("gemini")).toBe("cap");
    expect(accessoryForAgentType("opencode")).toBe("bandana");
    expect(accessoryForAgentType("unknown")).toBe("none");
    expect(buildProceduralAvatar("same-seed", "codex").pixels.some((pixel) => pixel.role === "lens")).toBe(true);
    expect(buildProceduralAvatar("same-seed", "gemini").pixels.some((pixel) => pixel.role === "lens")).toBe(false);
  });
});

describe("OfficeViewManager", () => {
  function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial));
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      values,
    };
  }

  it("defaults to the list view and restores a stored choice", () => {
    const storage = memoryStorage({ [WORKERS_VIEW_MODE_STORAGE_KEY]: "office" });
    const manager = new OfficeViewManager(storage);
    expect(manager.getSnapshot().viewMode).toBe("list");
    manager.hydrate();
    expect(manager.getSnapshot().viewMode).toBe("office");
  });

  it("persists the choice and ignores unknown or unreadable values", () => {
    const storage = memoryStorage({ [WORKERS_VIEW_MODE_STORAGE_KEY]: "spaceship" });
    const manager = new OfficeViewManager(storage);
    manager.hydrate();
    expect(manager.getSnapshot().viewMode).toBe("list");
    manager.setViewMode("office");
    expect(storage.values.get(WORKERS_VIEW_MODE_STORAGE_KEY)).toBe("office");

    const throwing = new OfficeViewManager(null);
    throwing.hydrate({ getItem: () => { throw new Error("blocked"); } });
    expect(throwing.getSnapshot().viewMode).toBe("list");
  });
});

describe("focusConversationComposer", () => {
  it("focuses the composer input when present", () => {
    let focused = false;
    const root = { querySelector: () => ({ focus: () => { focused = true; } }) } as unknown as Pick<Document, "querySelector">;
    expect(focusConversationComposer(root)).toBe(true);
    expect(focused).toBe(true);
    expect(focusConversationComposer({ querySelector: () => null } as unknown as Pick<Document, "querySelector">)).toBe(false);
  });
});
