import { defineConfig } from "vitest/config";
import path from "path";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**"],
    // Lifecycle scenarios spawn subprocesses and assert against SSE
    // tails over real ports; the default 5s test timeout is too tight
    // under parallel CPU load. Bump to 20s as a floor — well-behaved
    // tests still finish in milliseconds.
    testTimeout: 20_000,
  },
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
