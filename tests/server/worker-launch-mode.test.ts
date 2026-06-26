import { describe, expect, it } from "vitest";
import { resolveWorkerLaunchMode } from "@/server/worker-launch-mode";

describe("worker launch mode", () => {
  it("uses full access when YOLO mode is enabled and no explicit mode was requested", () => {
    expect(resolveWorkerLaunchMode(undefined, true)).toBe("full-access");
  });

  it("does not set a mode when YOLO mode is disabled and no explicit mode was requested", () => {
    expect(resolveWorkerLaunchMode(undefined, false)).toBeUndefined();
  });

  it("lets an explicit requested mode override the YOLO default", () => {
    expect(resolveWorkerLaunchMode("read-only", true)).toBe("read-only");
  });
});
