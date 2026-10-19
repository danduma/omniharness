import { beforeEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
  getPriority: vi.fn(),
  setPriority: vi.fn(),
  emitNamedEvent: vi.fn(),
}));
vi.mock("node:os", () => ({ getPriority: boundary.getPriority, setPriority: boundary.setPriority }));
vi.mock("@/server/events/named-events", () => ({ emitNamedEvent: boundary.emitNamedEvent }));

import { lowerWorkerProcessPriority } from "@/server/worker-process-priority";

describe("worker process scheduling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.getPriority.mockReturnValue(0);
    boundary.setPriority.mockImplementation(() => undefined);
  });

  it("gives a worker less CPU priority without changing the control plane", () => {
    lowerWorkerProcessPriority(12345);
    expect(boundary.setPriority).toHaveBeenCalledExactlyOnceWith(12345, 10);
    expect(boundary.emitNamedEvent).toHaveBeenCalledWith({
      kind: "process.priority_lowered", pid: 12345, previousPriority: 0, priority: 10,
    });
  });

  it("never raises an already lower-priority worker", () => {
    boundary.getPriority.mockReturnValue(15);
    lowerWorkerProcessPriority(12345);
    expect(boundary.setPriority).not.toHaveBeenCalled();
  });

  it("does not target the current process when spawn has no pid", () => {
    lowerWorkerProcessPriority(undefined);
    lowerWorkerProcessPriority(0);
    lowerWorkerProcessPriority(process.pid);
    expect(boundary.getPriority).not.toHaveBeenCalled();
    expect(boundary.setPriority).not.toHaveBeenCalled();
  });

  it("reports scheduling failure without abandoning ownership of a spawned child", () => {
    boundary.setPriority.mockImplementation(() => { throw new Error("permission denied"); });
    expect(() => lowerWorkerProcessPriority(12345)).not.toThrow();
    expect(boundary.emitNamedEvent).toHaveBeenCalledWith({
      kind: "process.priority_failed", pid: 12345, reason: "permission denied",
    });
  });
});
