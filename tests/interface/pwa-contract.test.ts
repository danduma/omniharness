import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");
const publicRoot = path.join(repositoryRoot, "apps/interface/public");

function readPublic(name: string) {
  return fs.readFileSync(path.join(publicRoot, name), "utf8");
}

describe.sequential("PWA shell contract", () => {
  test("only versioned, non-sensitive interface assets are eligible for caching", () => {
    const source = readPublic("sw.js");

    expect(source).toContain('const APP_SHELL_URL = "/app-shell.html"');
    expect(source).toContain('const CACHE_PREFIX = "omniharness-static-"');
    expect(source).toContain("__OMNI_BUILD_HASH__");
    expect(source).toContain("__OMNI_PRECACHE_ASSETS__");
    expect(source).toContain("url.origin !== self.location.origin");
    expect(source).toContain('url.pathname.startsWith("/api/")');
    expect(source).toContain("return;");
    expect(source).toContain('credentials: "omit"');
    expect(source).toContain("STATIC_ASSET_PATHS.has(url.pathname)");
    expect(source).not.toContain("Authorization");
    expect(source).not.toContain("Cookie");
    expect(source).not.toContain('"/index.html"');
  });

  test("activation deletes only obsolete OmniHarness static caches", () => {
    const source = readPublic("sw.js");

    expect(source).toContain("key.startsWith(CACHE_PREFIX)");
    expect(source).toContain("key !== CACHE_NAME");
    expect(source).not.toMatch(/filter\(\(key\) => key !== CACHE_NAME\)/);
  });

  test("the web build replaces cache placeholders with deterministic assets", () => {
    execFileSync("pnpm", ["build:interface:web"], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "pipe",
    });
    const builtWorker = fs.readFileSync(
      path.join(repositoryRoot, "dist/interface/sw.js"),
      "utf8",
    );

    expect(builtWorker).not.toContain("__OMNI_BUILD_HASH__");
    expect(builtWorker).not.toContain("__OMNI_PRECACHE_ASSETS__");
    expect(builtWorker).toMatch(/const BUILD_HASH = "[a-f0-9]{16}"/);
    expect(builtWorker).toContain("`${CACHE_PREFIX}${BUILD_HASH}`");
    expect(builtWorker).toContain("/app-shell.html");
    expect(builtWorker).toMatch(/\/assets\/[^"]+\.js/);
    expect(builtWorker).not.toContain('"/index.html"');

    const mainAsset = fs.readdirSync(path.join(repositoryRoot, "dist/interface/assets"))
      .find((name) => /^main-.*\.js$/.test(name));
    expect(mainAsset).toBeDefined();
    const mainSource = fs.readFileSync(
      path.join(repositoryRoot, "dist/interface/assets", mainAsset!),
      "utf8",
    );
    expect(mainSource).not.toContain("__OMNI_PWA_BUILD__");
    expect(mainSource).toContain('serviceWorker.register("/sw.js"');
  }, 60_000);
});
