import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const root = process.cwd();

function readText(relativePath: string) {
  return fs.readFileSync(path.resolve(root, relativePath), "utf8");
}

describe("PWA installability", () => {
  test("app exposes mobile install metadata from the root layout", () => {
    const layoutSource = readText("src/app/layout.tsx");

    expect(layoutSource).toContain('manifest: "/manifest.webmanifest"');
    expect(layoutSource).toContain("appleWebApp");
    expect(layoutSource).toContain('"apple-mobile-web-app-capable": "yes"');
    expect(layoutSource).toContain("/icons/apple-touch-icon.png");
    expect(layoutSource).toContain("export const viewport");
    expect(layoutSource).toContain("<PwaBootstrap");
  });

  test("manifest includes the members required by mobile install prompts", () => {
    const manifest = JSON.parse(readText("public/manifest.webmanifest"));

    expect(manifest.name).toBe("OmniHarness");
    expect(manifest.short_name).toBe("OmniHarness");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.prefer_related_applications).toBe(false);
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any maskable",
        }),
      ]),
    );
  });

  test("bootstrap registers the service worker only when the browser supports it", () => {
    const bootstrapSource = readText("src/components/PwaBootstrap.tsx");
    const pwaSource = readText("src/lib/pwa.ts");

    expect(bootstrapSource).toContain('"use client"');
    expect(bootstrapSource).toContain("registerServiceWorker");
    expect(pwaSource).toContain('"serviceWorker" in navigator');
    expect(pwaSource).toContain('navigator.serviceWorker.register("/sw.js"');
  });

  test("service worker keeps dynamic app data network-first and provides an offline fallback", () => {
    const serviceWorkerSource = readText("public/sw.js");

    expect(serviceWorkerSource).toContain('self.addEventListener("install"');
    expect(serviceWorkerSource).toContain('self.addEventListener("activate"');
    expect(serviceWorkerSource).toContain('self.addEventListener("fetch"');
    expect(serviceWorkerSource).toContain('request.mode === "navigate"');
    expect(serviceWorkerSource).toContain("/offline.html");
    expect(serviceWorkerSource).toContain('pathname.startsWith("/api/")');
  });
});
