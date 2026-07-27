import { defineConfig } from "@playwright/test";
import { assertLoopbackUrl } from "./tests/e2e/live/safety";

const baseURL = assertLoopbackUrl(
  process.env.OMNIHARNESS_LIVE_E2E_BASE_URL?.trim() || "http://127.0.0.1:3035",
).origin;

export default defineConfig({
  testDir: "./tests/e2e/live",
  testMatch: "claude-gpt56-lifecycle.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45 * 60 * 1000,
  outputDir: "test-results/live",
  globalSetup: "./tests/e2e/live/global-setup.ts",
  globalTeardown: "./tests/e2e/live/global-teardown.ts",
  use: {
    baseURL,
    actionTimeout: 30_000,
    storageState: "test-results/live-auth-state.json",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
