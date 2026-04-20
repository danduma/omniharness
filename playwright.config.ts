import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:4010",
  },
  webServer: {
    command: "MOCK_LLM=true PORT=4010 pnpm dev",
    url: "http://127.0.0.1:4010",
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      MOCK_LLM: "true",
      PORT: "4010",
    },
  },
});
