import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { prepareStaticInterface } from "@/runtime/http/static-files";

const roots: string[] = [];

async function makeStaticRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "omni-static-contract-"));
  roots.push(root);
  await fs.mkdir(path.join(root, "assets"));
  const themeScript = "document.documentElement.dataset.theme = 'ready';";
  const indexHtml = `<!doctype html><div id="root"></div><script id="omni-theme-bootstrap">${themeScript}</script><script src="/assets/app-abc123.js"></script>`;
  const appShellHtml = "<!doctype html><div id=\"root\"></div>";
  const asset = "window.omniReady = true;";
  await fs.writeFile(path.join(root, "index.html"), indexHtml);
  await fs.writeFile(path.join(root, "app-shell.html"), appShellHtml);
  await fs.writeFile(path.join(root, "assets/app-abc123.js"), asset);
  await fs.writeFile(path.join(root, "csp-manifest.json"), JSON.stringify({
    schemaVersion: 1,
    themeScriptSha256: crypto.createHash("sha256").update(themeScript).digest("base64"),
    assets: [{
      path: "assets/app-abc123.js",
      sha256: crypto.createHash("sha256").update(asset).digest("base64"),
    }],
  }));
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => fs.rm(root, {
    recursive: true,
    force: true,
  })));
});

describe("prepareStaticInterface", () => {
  it("injects escaped bootstrap JSON and resolves supported session deep links", async () => {
    const root = await makeStaticRoot();
    const seen: Array<{ selectedRunId: string | null; url: string }> = [];
    const staticInterface = await prepareStaticInterface({
      staticDir: root,
      explicit: true,
      mode: "web",
      buildBootstrap: async ({ request, selectedRunId }) => {
        seen.push({ selectedRunId, url: request.url });
        return { dangerous: "</script><script>alert(1)</script>", selectedRunId };
      },
    });

    for (const route of [
      "/?run=12345678-1234-1234-1234-123456789abc",
      "/session/12345678-1234-1234-1234-123456789abc",
      "/session/abcdef123456",
    ]) {
      const response = await staticInterface.handle(new Request(`http://runner.test${route}`));
      expect(response?.status).toBe(200);
      const html = await response!.text();
      expect(html).toContain('id="omni-bootstrap"');
      expect(html).not.toContain("</script><script>alert(1)</script>");
      expect(html).toContain("\\u003c/script\\u003e");
      expect(response?.headers.get("cache-control")).toBe("no-store");
    }

    expect(seen.map((entry) => entry.selectedRunId)).toEqual([
      "12345678-1234-1234-1234-123456789abc",
      "12345678-1234-1234-1234-123456789abc",
      "abcdef123456",
    ]);
  });

  it("uses SPA fallback only for extensionless navigations and preserves API and asset 404s", async () => {
    const root = await makeStaticRoot();
    const staticInterface = await prepareStaticInterface({
      staticDir: root,
      explicit: true,
      mode: "web",
      buildBootstrap: async () => ({ ok: true }),
    });

    expect((await staticInterface.handle(new Request("http://runner.test/projects")))?.status).toBe(200);
    const mainPage = await staticInterface.handle(new Request("http://runner.test/"));
    const authorizationPage = await staticInterface.handle(
      new Request("http://runner.test/authorize-interface"),
    );
    expect(mainPage?.headers.get("cross-origin-opener-policy")).toBe(
      "same-origin-allow-popups",
    );
    expect(authorizationPage?.headers.get("cross-origin-opener-policy")).toBe(
      "unsafe-none",
    );
    expect(await staticInterface.handle(new Request("http://runner.test/api/missing"))).toBeNull();
    expect((await staticInterface.handle(new Request("http://runner.test/assets/missing.js")))?.status).toBe(404);
    const asset = await staticInterface.handle(new Request("http://runner.test/assets/app-abc123.js"));
    expect(asset?.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("serves the current interface entry point after an in-place rebuild", async () => {
    const root = await makeStaticRoot();
    const staticInterface = await prepareStaticInterface({
      staticDir: root,
      explicit: true,
      mode: "web",
      buildBootstrap: async () => ({ ok: true }),
    });

    const rebuiltAsset = "window.omniRebuilt = true;";
    const rebuiltThemeScript = "document.documentElement.dataset.theme = 'rebuilt';";
    const rebuiltIndexHtml = `<!doctype html><div id="root"></div><script id="omni-theme-bootstrap">${rebuiltThemeScript}</script><script src="/assets/app-rebuilt.js"></script>`;
    await fs.writeFile(path.join(root, "assets/app-rebuilt.js"), rebuiltAsset);
    await fs.writeFile(path.join(root, "index.html"), rebuiltIndexHtml);
    await fs.writeFile(path.join(root, "csp-manifest.json"), JSON.stringify({
      schemaVersion: 1,
      themeScriptSha256: crypto.createHash("sha256").update(rebuiltThemeScript).digest("base64"),
      assets: [{
        path: "assets/app-rebuilt.js",
        sha256: crypto.createHash("sha256").update(rebuiltAsset).digest("base64"),
      }],
    }));
    await fs.rm(path.join(root, "assets/app-abc123.js"));

    const page = await staticInterface.handle(new Request("http://runner.test/"));
    expect(await page?.text()).toContain("/assets/app-rebuilt.js");
    expect(page?.headers.get("content-security-policy")).toContain(
      `'sha256-${crypto.createHash("sha256").update(rebuiltThemeScript).digest("base64")}'`,
    );
    expect(
      (await staticInterface.handle(new Request("http://runner.test/assets/app-rebuilt.js")))?.status,
    ).toBe(200);
  });

  it("rejects traversal and symlinks that escape the static root", async () => {
    const root = await makeStaticRoot();
    const outside = await fs.mkdtemp(path.join(os.tmpdir(), "omni-static-outside-"));
    roots.push(outside);
    await fs.writeFile(path.join(outside, "secret.txt"), "secret");
    await fs.symlink(path.join(outside, "secret.txt"), path.join(root, "assets/escape.txt"));
    const staticInterface = await prepareStaticInterface({
      staticDir: root,
      explicit: true,
      mode: "web",
      buildBootstrap: async () => ({ ok: true }),
    });

    expect((await staticInterface.handle(new Request("http://runner.test/..%2Fsecret.txt")))?.status).toBe(403);
    expect((await staticInterface.handle(new Request("http://runner.test/assets/escape.txt")))?.status).toBe(403);
  });

  it("fails explicit missing, malformed, and mismatched manifests", async () => {
    const missing = path.join(os.tmpdir(), `omni-missing-${crypto.randomUUID()}`);
    await expect(prepareStaticInterface({
      staticDir: missing,
      explicit: true,
      mode: "web",
    })).rejects.toThrow(/does not exist/i);

    const malformed = await makeStaticRoot();
    await fs.writeFile(path.join(malformed, "csp-manifest.json"), "{");
    await expect(prepareStaticInterface({
      staticDir: malformed,
      explicit: true,
      mode: "web",
    })).rejects.toThrow(/manifest/i);

    const mismatched = await makeStaticRoot();
    const manifestPath = path.join(mismatched, "csp-manifest.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    manifest.themeScriptSha256 = "wrong";
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    await expect(prepareStaticInterface({
      staticDir: mismatched,
      explicit: true,
      mode: "web",
    })).rejects.toThrow(/theme script/i);
  });
});
