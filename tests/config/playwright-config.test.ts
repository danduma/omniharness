import { describe, expect, it } from "vitest";
import playwrightConfig from "../../playwright.config";

describe("normal Playwright configuration", () => {
  it("runs product specs without collecting Vitest or live-agent tests", () => {
    expect(playwrightConfig.testDir).toBe("./tests/e2e");
    expect(playwrightConfig.testMatch).toBe("**/*.spec.ts");
    expect(playwrightConfig.testIgnore).toEqual([
      "live/**",
      "autonomous-run.spec.ts",
    ]);
    expect(playwrightConfig.webServer).toMatchObject({
      env: {
        OMNIHARNESS_AUTH_PASSWORD: "test-password",
        OMNIHARNESS_TEST_BYPASS_AUTH: "true",
        OMNIHARNESS_E2E_BYPASS_AUTH: "true",
      },
    });
  });
});
