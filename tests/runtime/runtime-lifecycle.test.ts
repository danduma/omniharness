import { beforeEach, describe, expect, it } from "vitest";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { createOmniRuntime } from "@/runtime";

describe("createOmniRuntime", () => {
  beforeEach(() => {
    __resetNamedEventsForTests();
  });

  it("starts and stops once while emitting typed runtime lifecycle events", async () => {
    const runtime = createOmniRuntime({
      surface: "vscode",
      label: "VS Code Extension",
    });

    const firstStart = await runtime.start();
    const secondStart = await runtime.start();
    await runtime.stop("test_complete");
    await runtime.stop("test_complete");

    expect(firstStart).toBe(secondStart);
    expect(runtime.getStatus()).toBe("stopped");

    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toEqual([
      expect.objectContaining({
        kind: "runtime.started",
        surface: "vscode",
        label: "VS Code Extension",
      }),
      expect.objectContaining({
        kind: "runtime.stopped",
        surface: "vscode",
        reason: "test_complete",
      }),
    ]);
  });

  it("emits runtime.start_failed and error.surfaced when startup fails", async () => {
    const runtime = createOmniRuntime({
      surface: "electron",
      label: "Electron",
      hooks: {
        onStart: async () => {
          throw new Error("port unavailable");
        },
      },
    });

    await expect(runtime.start()).rejects.toThrow("port unavailable");
    expect(runtime.getStatus()).toBe("failed");

    const events = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(events).toEqual([
      expect.objectContaining({
        kind: "runtime.start_failed",
        surface: "electron",
        reason: "port unavailable",
      }),
      expect.objectContaining({
        kind: "error.surfaced",
        code: "runtime.start_failed",
        surface: "log",
        message: "port unavailable",
      }),
    ]);
  });
});
