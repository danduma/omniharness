import path from "node:path";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/e2e/live/**/*.test.{ts,tsx}"],
    testTimeout: 20_000,
  },
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
