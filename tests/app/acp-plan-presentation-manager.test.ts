import { describe, expect, it, vi } from "vitest";
import {
  AcpPlanPresentationManager,
  COMPLETION_CELEBRATION_MS,
  COMPLETION_FADE_MS,
} from "@/interface/home/AcpPlanPresentationManager";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("AcpPlanPresentationManager", () => {
  it("keeps expansion only for the current run and worker", () => {
    const manager = new AcpPlanPresentationManager();

    manager.setOwner("run-1", "worker-1");
    manager.toggle("run-1", "worker-1");
    expect(manager.getSnapshot()).toMatchObject({ ownerKey: "run-1/worker-1", expanded: true });

    manager.setOwner("run-1", "worker-2");
    expect(manager.getSnapshot()).toMatchObject({ ownerKey: "run-1/worker-2", expanded: false });

    manager.toggle("run-1", "worker-1");
    expect(manager.getSnapshot()).toMatchObject({ ownerKey: "run-1/worker-2", expanded: false });
  });

  it("remembers expansion independently for each session and across manager hydration", () => {
    const storage = new MemoryStorage();
    const manager = new AcpPlanPresentationManager({ storage });

    manager.setOwner("run-1", "worker-1");
    manager.toggle("run-1", "worker-1");
    manager.setOwner("run-2", "worker-2");
    expect(manager.getSnapshot().expanded).toBe(false);

    manager.setOwner("run-1", "worker-1");
    expect(manager.getSnapshot().expanded).toBe(true);

    const restored = new AcpPlanPresentationManager({ storage });
    restored.setOwner("run-1", "worker-1");
    expect(restored.getSnapshot().expanded).toBe(true);
    restored.toggle("run-1", "worker-1");

    const restoredAgain = new AcpPlanPresentationManager({ storage });
    restoredAgain.setOwner("run-1", "worker-1");
    expect(restoredAgain.getSnapshot().expanded).toBe(false);
  });

  it("celebrates a completed plan before fading it out", () => {
    vi.useFakeTimers();
    try {
      const manager = new AcpPlanPresentationManager();
      manager.setOwner("run-1", "worker-1");
      expect(manager.getSnapshot().ownerKey).toBe("run-1/worker-1");

      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      expect(manager.getSnapshot()).toMatchObject({
        expanded: true,
        completionPlanKey: "plan-5",
        completionPhase: "celebrating",
      });

      vi.advanceTimersByTime(COMPLETION_CELEBRATION_MS);
      expect(manager.getSnapshot().completionPhase).toBe("fading");

      vi.advanceTimersByTime(COMPLETION_FADE_MS);
      expect(manager.getSnapshot().completionPhase).toBe("dismissed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores the plan when a new incomplete update arrives", () => {
    vi.useFakeTimers();
    try {
      const manager = new AcpPlanPresentationManager();
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      manager.syncCompletion("run-1", "worker-1", "plan-6", false);

      expect(manager.getSnapshot()).toMatchObject({
        expanded: false,
        completionPlanKey: null,
        completionPhase: "idle",
      });
      vi.advanceTimersByTime(COMPLETION_CELEBRATION_MS + COMPLETION_FADE_MS);
      expect(manager.getSnapshot().completionPhase).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the same completed plan dismissed when its owner becomes active again", () => {
    vi.useFakeTimers();
    try {
      const manager = new AcpPlanPresentationManager();
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      vi.advanceTimersByTime(COMPLETION_CELEBRATION_MS + COMPLETION_FADE_MS);
      expect(manager.getSnapshot().completionPhase).toBe("dismissed");

      manager.setOwner(null, null);
      expect(manager.getCompletionPhase("run-1", "worker-1", "plan-5")).toBe("dismissed");
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);

      expect(manager.getSnapshot()).toMatchObject({
        completionPlanKey: "plan-5",
        completionPhase: "dismissed",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a visually fading plan dismissed if ownership changes before its timer finishes", () => {
    vi.useFakeTimers();
    try {
      const manager = new AcpPlanPresentationManager();
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      vi.advanceTimersByTime(COMPLETION_CELEBRATION_MS);
      expect(manager.getSnapshot().completionPhase).toBe("fading");

      manager.setOwner(null, null);
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);

      expect(manager.getSnapshot().completionPhase).toBe("dismissed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a dismissal through transient missing-plan state and manager hydration", () => {
    vi.useFakeTimers();
    try {
      const storage = new MemoryStorage();
      const manager = new AcpPlanPresentationManager({ storage });
      manager.setOwner("run-1", "worker-1");
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      vi.advanceTimersByTime(COMPLETION_CELEBRATION_MS + COMPLETION_FADE_MS);

      manager.syncCompletion("run-1", "worker-1", "", false);
      manager.syncCompletion("run-1", "worker-1", "plan-5", true);
      expect(manager.getSnapshot().completionPhase).toBe("dismissed");

      const restored = new AcpPlanPresentationManager({ storage });
      restored.setOwner("run-1", "worker-1");
      restored.syncCompletion("run-1", "worker-1", "plan-5", true);
      expect(restored.getSnapshot().completionPhase).toBe("dismissed");
      expect(restored.isCompletionDismissed("run-1", "worker-1", "plan-5")).toBe(true);

      restored.syncCompletion("run-1", "worker-1", "plan-6", false);
      expect(restored.getSnapshot().completionPhase).toBe("idle");
      expect(restored.isCompletionDismissed("run-1", "worker-1", "plan-5")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
