import path from "node:path";
import { describe, expect, it } from "vitest";
import liveConfig from "../../../playwright.live.config";

describe("live Playwright configuration", () => {
  it("is isolated, local, single-worker, and bounded", () => {
    expect(liveConfig.testDir).toBe("./tests/e2e/live");
    expect(liveConfig.testMatch).toBe("claude-gpt56-lifecycle.spec.ts");
    expect(liveConfig.webServer).toBeUndefined();
    expect(liveConfig.workers).toBe(1);
    expect(liveConfig.retries).toBe(0);
    expect(liveConfig.timeout).toBe(45 * 60 * 1000);
    expect(liveConfig.use?.actionTimeout).toBe(30_000);
    expect(liveConfig.fullyParallel).toBe(false);
    expect(liveConfig.outputDir).toBe("test-results/live");
    expect(liveConfig.use).toMatchObject({
      baseURL: "http://127.0.0.1:3035",
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
    });
    expect(liveConfig.use?.storageState).toBe("test-results/live-auth-state.json");
    expect(path.resolve(String(liveConfig.use?.storageState))).not.toContain(
      `${path.resolve(String(liveConfig.outputDir))}${path.sep}`,
    );
    expect(liveConfig.globalSetup).toContain("global-setup");
    expect(liveConfig.globalTeardown).toContain("global-teardown");
  });
});
