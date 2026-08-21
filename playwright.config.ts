import { defineConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Browser tests that seed control-plane state must never share the developer's
// real sqlite.db. Set one per Playwright invocation and pass it to both the
// test workers and the web-server child.
const configuredE2eRoot = process.env.OMNIHARNESS_E2E_ROOT?.trim()
  || process.env.OMNIHARNESS_ROOT?.trim();
const e2eRoot = configuredE2eRoot
  || path.join(tmpdir(), `omniharness-playwright-${process.pid}`);
if (!configuredE2eRoot) process.env.OMNIHARNESS_E2E_EPHEMERAL_ROOT = "1";
mkdirSync(e2eRoot, { recursive: true });
process.env.OMNIHARNESS_ROOT = e2eRoot;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  testIgnore: [
    "live/**",
    "autonomous-run.spec.ts",
  ],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4010",
    channel: "chrome",
    launchOptions: {
      args: ["--enable-precise-memory-info"],
    },
  },
  webServer: {
    command: "MOCK_LLM=true OMNIHARNESS_AUTH_PASSWORD=test-password OMNIHARNESS_RUNNER_PORT=4011 OMNIHARNESS_INTERFACE_PORT=4010 OMNIHARNESS_VITE_RUNNER_URL=http://127.0.0.1:4011 OMNIHARNESS_TEST_BYPASS_AUTH=true OMNIHARNESS_E2E_BYPASS_AUTH=true pnpm dev",
    url: "http://127.0.0.1:4010",
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      MOCK_LLM: "true",
      OMNIHARNESS_AUTH_PASSWORD: "test-password",
      OMNIHARNESS_RUNNER_PORT: "4011",
      OMNIHARNESS_INTERFACE_PORT: "4010",
      OMNIHARNESS_VITE_RUNNER_URL: "http://127.0.0.1:4011",
      OMNIHARNESS_TEST_BYPASS_AUTH: "true",
      OMNIHARNESS_E2E_BYPASS_AUTH: "true",
      OMNIHARNESS_ROOT: e2eRoot,
    },
  },
});
