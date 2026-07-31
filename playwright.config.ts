import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  testIgnore: [
    "live/**",
    "autonomous-run.spec.ts",
  ],
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
    },
  },
});
