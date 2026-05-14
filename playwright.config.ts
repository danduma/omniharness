import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4010",
  },
  webServer: {
    command: "MOCK_LLM=true PORT=4011 OMNIHARNESS_DEV_PROXY_PORT=4010 OMNIHARNESS_DEV_PROXY_TARGET=http://127.0.0.1:4011 OMNIHARNESS_TEST_BYPASS_AUTH=true OMNIHARNESS_E2E_BYPASS_AUTH=true pnpm dev",
    url: "http://127.0.0.1:4010",
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      MOCK_LLM: "true",
      PORT: "4011",
      OMNIHARNESS_DEV_PROXY_PORT: "4010",
      OMNIHARNESS_DEV_PROXY_TARGET: "http://127.0.0.1:4011",
      OMNIHARNESS_TEST_BYPASS_AUTH: "true",
      OMNIHARNESS_E2E_BYPASS_AUTH: "true",
    },
  },
});
