import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  RealRunnerHarness,
  disposeRunnerSet,
  startRunnerSet,
} from "./multi-runner-harness";

type SeedCredential = {
  runner: RealRunnerHarness;
  token: string | null;
};

async function seedRunnerProfiles(
  page: Page,
  runners: SeedCredential[],
) {
  await page.addInitScript(({ seeds }) => {
    const now = new Date().toISOString();
    const profiles = seeds.map((seed, index) => ({
      id: index === 0 ? "same-origin" : `runner-${index}`,
      runnerInstanceId: seed.identity,
      label: seed.name,
      baseUrl: seed.origin,
      authTransport: index === 0 ? "cookie" : "bearer",
      credentialRef: index === 0 ? null : `credential-${index}`,
      schemaVersion: 1,
      createdAt: now,
      lastConnectedAt: null,
      isSameOrigin: index === 0,
    }));
    localStorage.setItem("omni.onboarding.seen", "1");
    localStorage.setItem("omniharness.runnerProfiles", JSON.stringify({
      schemaVersion: 1,
      activeRunnerId: "same-origin",
      profiles,
      scopedState: {},
    }));
    localStorage.setItem("omniharness.runnerCredentials", JSON.stringify({
      schemaVersion: 1,
      credentials: Object.fromEntries(
        seeds.slice(1).map((seed, index) => {
          const profileIndex = index + 1;
          const handle = `credential-${profileIndex}`;
          return [handle, {
            handle,
            profileId: `runner-${profileIndex}`,
            origin: seed.origin,
            runnerInstanceId: seed.identity,
            token: seed.token,
          }];
        }),
      ),
    }));
  }, {
    seeds: runners.map(({ runner, token }) => ({
      origin: runner.origin,
      identity: runner.identity,
      name: runner.options.name,
      token,
    })),
  });
}

async function usedHeap(page: Page) {
  await page.requestGC();
  return page.evaluate(() => {
    const memory = (performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }).memory;
    if (!memory) {
      throw new Error("Chrome precise memory information is unavailable.");
    }
    return memory.usedJSHeapSize;
  });
}

async function openMeasuredPage(
  browser: Browser,
  interfaceRunner: RealRunnerHarness,
  seeds: SeedCredential[],
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const uncaught: string[] = [];
  const eventStreamOrigins = new Set<string>();
  page.on("pageerror", (error) => uncaught.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/events")) {
      eventStreamOrigins.add(new URL(request.url()).origin);
    }
  });
  await seedRunnerProfiles(page, seeds);
  await page.goto(interfaceRunner.origin);
  await expect(page.locator("#runner-switcher")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
  return { context, page, uncaught, eventStreamOrigins };
}

test("keeps eight real runner streams live within the client memory budget", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const runners = await startRunnerSet(
    Array.from({ length: 8 }, (_, index) => `Scale Runner ${index + 1}`),
    { bypassAuth: true },
  );
  try {
    const interfaceOrigin = runners[0].origin;
    const credentials: SeedCredential[] = [{ runner: runners[0], token: null }];
    for (const runner of runners.slice(1)) {
      const issued = await runner.issueBrowserToken(interfaceOrigin);
      credentials.push({ runner, token: issued.token });
    }

    const baseline = await openMeasuredPage(browser, runners[0], credentials.slice(0, 1));
    const baselineBytes = await usedHeap(baseline.page);
    await baseline.context.close();

    const measured = await openMeasuredPage(browser, runners[0], credentials);
    await measured.page.locator("#runner-switcher").click();
    for (const runner of runners) {
      await expect(
        measured.page.getByRole("menuitem").filter({ hasText: runner.options.name }),
      ).toBeVisible();
    }
    await measured.page.keyboard.press("Escape");
    await expect.poll(
      () => [...measured.eventStreamOrigins].sort(),
      { timeout: 30_000 },
    ).toEqual(runners.map((runner) => runner.origin).sort());

    const aggregateBytes = await usedHeap(measured.page);
    const incrementalPerRunner = Math.max(
      0,
      aggregateBytes - baselineBytes,
    ) / 7;
    expect(incrementalPerRunner).toBeLessThan(40 * 1024 * 1024);
    expect(aggregateBytes).toBeLessThan(750 * 1024 * 1024);
    expect(measured.uncaught).toEqual([]);

    const revisionWindows = await Promise.all(runners.slice(0, 2).map(
      (runner) => runner.bootstrap().then((bootstrap) => bootstrap.runner.apiRevision),
    ));
    expect(revisionWindows[0]!.minimum).toBeLessThanOrEqual(
      revisionWindows[1]!.current,
    );
    await measured.context.close();
  } finally {
    await disposeRunnerSet(runners);
  }
});
