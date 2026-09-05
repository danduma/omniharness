import fs from "fs";
import path from "path";
import { describe, expect, test } from "vitest";

const root = process.cwd();

function readText(relativePath: string) {
  return fs.readFileSync(path.resolve(root, relativePath), "utf8");
}

describe("PWA installability", () => {
  test("the Vite interface exposes adaptive Android system-bar colors", () => {
    const indexSource = readText("apps/interface/index.html");
    const appShellSource = readText("apps/interface/app-shell.html");
    const lifecycleSource = readText("src/interface/home/useHomeLifecycle.ts");
    const globalStyles = readText("src/interface/styles/globals.css");

    for (const html of [indexSource, appShellSource]) {
      expect(html).toContain(
        'name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"',
      );
      expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
      expect(html).toContain('name="apple-mobile-web-app-capable" content="yes"');
      expect(html).toContain("/icons/apple-touch-icon-v2.png");
      expect(html).toContain(
        'name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff"',
      );
      expect(html).toContain(
        'name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0d10"',
      );
      expect(html).toContain('var lightThemeColor = "#ffffff"');
      expect(html).toContain('var darkThemeColor = "#0b0d10"');
      expect(html).toContain("document.querySelectorAll('meta[name=\"theme-color\"]')");
      expect(html).toContain("themeColorMeta.setAttribute");
      expect(html).not.toContain("#2f6652");
      expect(html).not.toContain("#e86b20");
    }

    expect(lifecycleSource).toContain(
      "document.querySelectorAll('meta[name=\"theme-color\"]')",
    );
    expect(globalStyles).toContain("#root {");
    expect(globalStyles).toContain("padding-top: env(safe-area-inset-top, 0px)");
    expect(globalStyles).toContain("padding-right: env(safe-area-inset-right, 0px)");
    expect(globalStyles).toContain("padding-bottom: env(safe-area-inset-bottom, 0px)");
    expect(globalStyles).toContain("padding-left: env(safe-area-inset-left, 0px)");
  });

  test("manifest includes the members required by mobile install prompts", () => {
    const manifest = JSON.parse(readText("apps/interface/public/manifest.webmanifest"));

    expect(manifest.name).toBe("OmniHarness");
    expect(manifest.short_name).toBe("OmniHarness");
    expect(manifest.start_url).toBe("/app-shell.html");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#0b0d10");
    expect(manifest.theme_color).toBe("#0b0d10");
    expect(manifest).not.toHaveProperty("orientation");
    expect(manifest.prefer_related_applications).toBe(false);
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192-v2.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512-v2.png",
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
    expect(pwaSource).toContain('typeof __OMNI_PWA_BUILD__ !== "undefined"');
    expect(pwaSource).toContain("getRegistrations");
    expect(pwaSource).toContain('navigator.serviceWorker.register("/sw.js"');
  });

  test("service worker keeps dynamic app data network-first and provides an offline fallback", () => {
    const serviceWorkerSource = readText("apps/interface/public/sw.js");

    expect(serviceWorkerSource).toContain('self.addEventListener("install"');
    expect(serviceWorkerSource).toContain('self.addEventListener("activate"');
    expect(serviceWorkerSource).toContain('self.addEventListener("fetch"');
    expect(serviceWorkerSource).toContain('request.mode === "navigate"');
    expect(serviceWorkerSource).toContain("/app-shell.html");
    expect(serviceWorkerSource).toContain('pathname.startsWith("/api/")');
    expect(serviceWorkerSource).toContain("url.origin !== self.location.origin");
    expect(serviceWorkerSource).not.toContain("/offline.html");
    expect(serviceWorkerSource).not.toContain('"/index.html"');
  });

  test("service worker notification clicks reopen the relevant conversation", () => {
    const serviceWorkerSource = readText("apps/interface/public/sw.js");

    expect(serviceWorkerSource).toContain('self.addEventListener("notificationclick"');
    expect(serviceWorkerSource).toContain("event.notification.data?.url");
    expect(serviceWorkerSource).toContain("client.url === targetUrl.href");
    expect(serviceWorkerSource).toContain("navigableClient.navigate(targetUrl.href)");
    expect(serviceWorkerSource).toContain("self.clients.openWindow(targetUrl.href)");
    expect(serviceWorkerSource).not.toContain('clients.find((client) => "focus" in client)');
  });

  test("service worker suppresses push notifications while any app window is visible", () => {
    const serviceWorkerSource = readText("apps/interface/public/sw.js");

    expect(serviceWorkerSource).toContain("hasVisibleWindowClient");
    expect(serviceWorkerSource).toContain('client.visibilityState === "visible"');
    expect(serviceWorkerSource).toContain("if (hasVisibleClient) {");
    expect(serviceWorkerSource).toContain("return;");
  });
});
