import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const repositoryRoot = path.resolve(__dirname, "../..");
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-pwa-build-"));
const WIDTH_COMPARISON_RUN_ID = "11111111-1111-4111-8111-111111111111";
const contentTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

function emptyBootstrap(selectedRunId: string | null = null) {
  const initialEventState = {
    messages: [],
    plans: [],
    runs: selectedRunId ? [{
      id: selectedRunId,
      planId: "pwa-width-plan",
      mode: "direct",
      status: "done",
      createdAt: "2026-08-12T10:00:00.000Z",
      updatedAt: "2026-08-12T10:01:00.000Z",
      projectPath: null,
      title: "Width comparison run",
    }] : [],
    accounts: [],
    agents: [],
    workers: [],
    planItems: [],
    clarifications: [],
    executionEvents: [],
    supervisorInterventions: [],
  };
  return {
    id: "pwa-browser-test",
    route: {
      selectedRunId,
      draftProjectPath: null,
      pairTokenFromUrl: null,
    },
    initialEventState,
    initialLastEventId: "0",
    initialQueries: {
      session: {
        enabled: false,
        authenticated: true,
        currentSession: null,
        sessions: [],
      },
      settings: { values: {} },
    },
    features: { unifiedWorkerStream: true },
    runner: {
      runnerInstanceId: "pwa-browser-runner",
      name: "PWA browser runner",
      apiRevision: { current: 1, minimum: 1 },
      capabilities: ["unified_worker_stream"],
      bridgeState: "ready",
    },
  };
}

function listen(server: http.Server) {
  return new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not expose a TCP address."));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: http.Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

describe.sequential("PWA browser behavior", () => {
  let appServer: http.Server;
  let remoteServer: http.Server;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let appOrigin = "";
  let remoteOrigin = "";
  let apiProbeCount = 0;
  let remoteProbeCount = 0;

  beforeAll(async () => {
    execFileSync("pnpm", ["build:interface:web"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        OMNIHARNESS_INTERFACE_OUT_DIR: buildRoot,
      },
      stdio: "pipe",
    });

    appServer = http.createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", "http://localhost");
      if (requestUrl.pathname === "/api/runtime/bootstrap") {
        const selectedRunId = request.headers.referer?.includes(`/session/${WIDTH_COMPARISON_RUN_ID}`)
          ? WIDTH_COMPARISON_RUN_ID
          : null;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(emptyBootstrap(selectedRunId)));
        return;
      }
      if (requestUrl.pathname === "/api/probe") {
        apiProbeCount += 1;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ count: apiProbeCount }));
        return;
      }
      if (requestUrl.pathname.startsWith("/api/")) {
        response.statusCode = 404;
        response.end("not found");
        return;
      }

      const requested = requestUrl.pathname === "/"
        ? "index.html"
        : requestUrl.pathname.slice(1);
      let filePath = path.join(buildRoot, requested);
      if (!fs.existsSync(filePath) && !path.extname(requested)) {
        filePath = path.join(buildRoot, "index.html");
      }
      if (!filePath.startsWith(buildRoot) || !fs.existsSync(filePath)) {
        response.statusCode = 404;
        response.end("not found");
        return;
      }
      response.setHeader(
        "content-type",
        contentTypes[path.extname(filePath)] ?? "application/octet-stream",
      );
      fs.createReadStream(filePath).pipe(response);
    });

    remoteServer = http.createServer((_request, response) => {
      remoteProbeCount += 1;
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ count: remoteProbeCount }));
    });

    const [appPort, remotePort] = await Promise.all([
      listen(appServer),
      listen(remoteServer),
    ]);
    appOrigin = `http://127.0.0.1:${appPort}`;
    remoteOrigin = `http://127.0.0.1:${remotePort}`;
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
    page = await context.newPage();
  }, 60_000);

  afterAll(async () => {
    await context?.close();
    await browser?.close();
    await Promise.all([close(appServer), close(remoteServer)]);
    fs.rmSync(buildRoot, { recursive: true, force: true });
  });

  test("launches offline, recovers online, and never caches runner traffic", async () => {
    await page.goto(appOrigin, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) {
        throw new Error("Service worker did not activate.");
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await page.evaluate(async (otherOrigin) => {
      await fetch("/api/probe");
      await fetch("/api/probe");
      await fetch(`${otherOrigin}/probe`);
      await fetch(`${otherOrigin}/probe`);
    }, remoteOrigin);
    expect(apiProbeCount).toBe(2);
    expect(remoteProbeCount).toBe(2);

    const cachedRequests = await page.evaluate(async () => {
      const names = await caches.keys();
      const requests = await Promise.all(
        names.map(async (name) => (await caches.open(name)).keys()),
      );
      return requests.flat().map((request) => request.url);
    });
    expect(cachedRequests.some((url) => url.includes("/app-shell.html"))).toBe(true);
    expect(cachedRequests.some((url) => url.includes("/assets/"))).toBe(true);
    expect(cachedRequests.every((url) => !url.includes("/api/"))).toBe(true);
    expect(cachedRequests.every((url) => !url.startsWith(remoteOrigin))).toBe(true);

    await context.setOffline(true);
    await page.goto(`${appOrigin}/session/offline-test`, {
      waitUntil: "domcontentloaded",
    });
    expect(await page.title()).toBe("OmniHarness");
    expect(await page.locator("#root").count()).toBe(1);
    await expect.poll(() => page.locator("#runner-switcher").isVisible()).toBe(true);
    await expect.poll(
      () => page.getByText("Offline", { exact: true }).first().isVisible(),
    ).toBe(true);

    await context.setOffline(false);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(async () => page.locator("#root").innerHTML()).not.toBe("");
  }, 60_000);

  test("mobile new-session composer preserves controlled scroll and uses the responsive layout", async () => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(appOrigin, { waitUntil: "domcontentloaded" });

    const composer = page.locator('[data-composer-input="true"]');
    await expect.poll(() => composer.isVisible()).toBe(true);

    const mobileStyles = await composer.evaluate((textarea) => {
      const style = window.getComputedStyle(textarea);
      const composerShell = textarea.closest('[data-composer-dropzone="true"]');
      return {
        maxHeight: style.maxHeight,
        overflowY: style.overflowY,
        overscrollBehaviorY: style.overscrollBehaviorY,
        shellWidth: composerShell?.getBoundingClientRect().width,
        touchAction: style.touchAction,
      };
    });
    expect(mobileStyles).toMatchObject({
      maxHeight: "400px",
      overflowY: "auto",
      overscrollBehaviorY: "contain",
      shellWidth: 378,
      touchAction: "pan-y",
    });

    const longDraft = Array.from({ length: 40 }, (_, index) => `dictated line ${index}`).join("\n");
    await composer.evaluate((textarea, value) => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, value);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }, longDraft);
    await expect.poll(() => composer.inputValue()).toBe(longDraft);
    await expect.poll(() => composer.evaluate((textarea) => textarea.clientHeight)).toBe(400);

    const expectedScrollTop = await composer.evaluate((textarea) => {
      const nextScrollTop = Math.floor((textarea.scrollHeight - textarea.clientHeight) * 0.6);
      textarea.scrollTop = nextScrollTop;
      return nextScrollTop;
    });
    expect(expectedScrollTop).toBeGreaterThan(0);

    const correctedDraft = longDraft.replace("dictated line 2", "corrected dictated line 2");
    await composer.evaluate((textarea, { value, scrollTop }) => {
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error("Composer input is not a textarea.");
      }
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      valueSetter?.call(textarea, value);
      textarea.setSelectionRange(value.length, value.length);
      textarea.scrollTop = scrollTop;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }, { value: correctedDraft, scrollTop: expectedScrollTop });
    await expect.poll(() => composer.inputValue()).toBe(correctedDraft);
    await expect.poll(() => composer.evaluate((textarea) => textarea.scrollTop)).toBe(expectedScrollTop);

    await page.setViewportSize({ width: 800, height: 800 });
    await expect.poll(() => composer.evaluate((textarea) => window.getComputedStyle(textarea).maxHeight)).toBe("120px");

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${appOrigin}/session/${WIDTH_COMPARISON_RUN_ID}`, { waitUntil: "domcontentloaded" });
    const ongoingComposer = page.locator('[data-composer-input="true"]');
    await expect.poll(() => ongoingComposer.isVisible()).toBe(true);
    const ongoingStyles = await ongoingComposer.evaluate((textarea) => ({
      maxHeight: window.getComputedStyle(textarea).maxHeight,
      shellWidth: textarea.closest('[data-composer-dropzone="true"]')?.getBoundingClientRect().width,
    }));
    expect(ongoingStyles).toEqual({
      maxHeight: "100px",
      shellWidth: mobileStyles.shellWidth,
    });
  }, 60_000);

  test("a replacement worker activates and removes only its own old cache", async () => {
    await page.goto(appOrigin, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await caches.open("unrelated-test-cache");
      await caches.open("omniharness-static-obsolete");
      const registration = await navigator.serviceWorker.register("/sw.js?replacement=1", {
        scope: "/",
      });
      await new Promise<void>((resolve, reject) => {
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        if (worker?.state === "activated") {
          resolve();
          return;
        }
        worker?.addEventListener("statechange", () => {
          if (worker.state === "activated") {
            resolve();
          } else if (worker.state === "redundant") {
            reject(new Error("Replacement service worker became redundant."));
          }
        });
      });
    });

    const cacheNames = await page.evaluate(() => caches.keys());
    expect(cacheNames).toContain("unrelated-test-cache");
    expect(cacheNames).not.toContain("omniharness-static-obsolete");
    expect(cacheNames.filter((name) => name.startsWith("omniharness-static-"))).toHaveLength(1);
  }, 60_000);
});
