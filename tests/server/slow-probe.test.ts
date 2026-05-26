import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { startSlowProbe } from "@/server/slow-probe";

describe("slow-probe threshold dynamic behavior", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS;
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS;
    } else {
      process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it("should respect process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS dynamically", async () => {
    // If we set the environment variable to a very high value like 5000
    process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS = "5000";

    const probe1 = startSlowProbe("test-route");
    await new Promise((resolve) => setTimeout(resolve, 20));
    probe1.end();

    expect(console.log).not.toHaveBeenCalled();

    // Now if we set it to a very low value like 5
    process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS = "5";

    const probe2 = startSlowProbe("test-route-dynamic");
    await new Promise((resolve) => setTimeout(resolve, 20));
    probe2.end();

    // Under the current static implementation, this assertion will fail because
    // MIN_TOTAL_MS was evaluated exactly once when the module was loaded,
    // and ignores the new environment variable value of "5".
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[slow-probe] test-route-dynamic total="),
    );
  });

  it("should handle raw string variations like '200ms or more', '>200', and fallback to 200", async () => {
    // Set to '10ms or more'
    process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS = "10ms or more";
    const probe1 = startSlowProbe("test-parsing-ok");
    await new Promise((resolve) => setTimeout(resolve, 30));
    probe1.end();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("[slow-probe] test-parsing-ok total="),
    );

    vi.mocked(console.log).mockClear();

    // Set to '>200' which is malformed for parseInt (returns NaN) -> should fallback to default (200)
    process.env.OMNIHARNESS_SLOW_PROBE_MIN_MS = ">200";
    const probe2 = startSlowProbe("test-parsing-fallback");
    await new Promise((resolve) => setTimeout(resolve, 30));
    probe2.end();
    // 30ms is less than fallback 200ms, so it should NOT log
    expect(console.log).not.toHaveBeenCalled();
  });
});
