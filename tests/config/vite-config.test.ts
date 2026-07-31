import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repositoryRoot = process.cwd();
const viteConfigSource = fs.readFileSync(
  path.resolve(repositoryRoot, "apps/interface/vite.config.ts"),
  "utf8",
);

describe("Vite interface config", () => {
  test("keeps browser development on its own port and proxies APIs to the runner", () => {
    expect(viteConfigSource).toContain('OMNIHARNESS_INTERFACE_PORT ?? "5173"');
    expect(viteConfigSource).toContain(
      'OMNIHARNESS_VITE_RUNNER_URL ?? "http://127.0.0.1:3050"',
    );
    expect(viteConfigSource).toContain('"/api"');
    expect(viteConfigSource).toContain("changeOrigin: false");
  });

  test("builds both the normal page and mountable app shell", () => {
    expect(viteConfigSource).toContain('"app-shell"');
    expect(viteConfigSource).toContain("apps/interface/app-shell.html");
    expect(viteConfigSource).toContain("interfaceCspManifestPlugin()");
  });
});
