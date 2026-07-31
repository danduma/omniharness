import { expect, test, type Page } from "@playwright/test";
import {
  RealRunnerHarness,
  disposeRunnerSet,
  startRunnerSet,
} from "./multi-runner-harness";

test.describe.configure({ mode: "serial" });

let runners: RealRunnerHarness[] = [];

async function login(page: Page, runner: RealRunnerHarness) {
  await page.addInitScript(() => {
    window.localStorage.setItem("omni.onboarding.seen", "1");
  });
  await page.goto(runner.origin);
  await page.locator("#omni-password").fill(runner.options.password);
  await page.getByRole("button", { name: "Unlock OmniHarness" }).click();
  await expect(page.locator("#runner-switcher")).toBeVisible({ timeout: 30_000 });
  const setup = page.getByRole("dialog", { name: "Finish CLI setup" });
  if (await setup.isVisible().catch(() => false)) {
    await setup.getByRole("button", { name: "Cancel" }).click();
  }
}

async function connectRunner(
  page: Page,
  runner: RealRunnerHarness,
) {
  await page.locator("#runner-switcher").click();
  await page.getByText("Add runner", { exact: true }).click();
  await page.locator("#runner-label").fill(runner.options.name);
  await page.locator("#runner-url").fill(runner.origin);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const popup = await popupPromise;
  await popup.locator("#authorization-password").fill(runner.options.password);
  await popup.getByRole("button", { name: "Authorize", exact: true }).click();
  await popup.waitForEvent("close");
  await expect.poll(async () => {
    const switcher = page.locator("#runner-switcher");
    const count = await switcher.count();
    return {
      count,
      name: count ? await switcher.getAttribute("aria-label") : null,
      body: (await page.locator("body").innerText()).slice(0, 500),
      url: page.url(),
    };
  }, { timeout: 30_000 }).toMatchObject({
    count: 1,
    name: expect.stringContaining(runner.options.name),
  });
}

async function selectRunner(page: Page, name: string) {
  await page.locator("#runner-switcher").click();
  await page.getByRole("menuitem").filter({ hasText: name }).first().click();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(
    new RegExp(name),
  );
}

test.beforeAll(async () => {
  runners = await startRunnerSet(["Runner One", "Runner Two"]);
});

test.afterAll(async () => {
  await disposeRunnerSet(runners);
  runners = [];
});

test("connects two real packaged runners, switches workspaces, revokes, reauthorizes, and recovers after restart", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const [first, second] = runners;
  const uncaught: string[] = [];
  const streamRequests: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/events")) {
      streamRequests.push(request.url());
    }
  });

  await login(page, first);
  await connectRunner(page, second);
  const remoteAuthorization = await page.evaluate(async (runnerOrigin) => {
    const profiles = JSON.parse(
      localStorage.getItem("omniharness.runnerProfiles") ?? "{}",
    ) as {
      profiles?: Array<{
        baseUrl: string;
        credentialRef: string | null;
      }>;
    };
    const profile = profiles.profiles?.find((item) => item.baseUrl === runnerOrigin);
    const credentials = JSON.parse(
      localStorage.getItem("omniharness.runnerCredentials") ?? "{}",
    ) as {
      credentials?: Record<string, { token?: string }>;
    };
    const token = profile?.credentialRef
      ? credentials.credentials?.[profile.credentialRef]?.token
      : null;
    const response = token
      ? await fetch(`${runnerOrigin}/api/runtime/bootstrap`, {
        headers: { authorization: `Bearer ${token}` },
      })
      : null;
    const payload = response?.ok
      ? await response.json() as {
        initialQueries?: { session?: { authenticated?: boolean } };
      }
      : null;
    return {
      hasCredential: Boolean(token),
      status: response?.status ?? null,
      authenticated: payload?.initialQueries?.session?.authenticated ?? false,
    };
  }, second.origin);
  expect(remoteAuthorization).toEqual({
    hasCredential: true,
    status: 200,
    authenticated: true,
  });

  await page.locator("#runner-switcher").click();
  await expect(page.getByRole("menuitem").filter({ hasText: "Runner One" })).toBeVisible();
  const secondRunnerMenuItem = page.getByRole("menuitem").filter({
    hasText: "Runner Two",
  });
  await expect(secondRunnerMenuItem).toBeVisible();
  await expect(secondRunnerMenuItem).toContainText("Online");
  await page.keyboard.press("Escape");

  await selectRunner(page, "Runner One");
  await second.rename("Runner Two Background");
  await page.locator("#runner-switcher").click();
  await expect(
    page.getByRole("menuitem").filter({ hasText: "Runner Two Background" }),
  ).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press("Escape");
  await second.rename("Runner Two");
  await selectRunner(page, "Runner Two");

  await expect.poll(() => ({
    first: streamRequests.some((url) => url.startsWith(first.origin)),
    second: streamRequests.some((url) => url.startsWith(second.origin)),
  }), { timeout: 15_000 }).toEqual({ first: true, second: true });

  const sessionState = await page.evaluate(() => {
    const profiles = JSON.parse(
      window.localStorage.getItem("omniharness.runnerProfiles") ?? "{}",
    ) as { profiles?: Array<{ baseUrl?: string; credentialRef?: string | null }> };
    const profile = profiles.profiles?.find((item) => item.baseUrl !== location.origin);
    const credentials = JSON.parse(
      window.localStorage.getItem("omniharness.runnerCredentials") ?? "{}",
    ) as { credentials?: Record<string, { profileId: string }> };
    return {
      credentialRef: profile?.credentialRef ?? null,
      credentialHandles: Object.keys(credentials.credentials ?? {}),
    };
  });
  expect(sessionState.credentialRef).toBeTruthy();
  expect(sessionState.credentialHandles).not.toHaveLength(0);

  const adminCookie = await second.loginCookie();
  const sessionsResponse = await fetch(`${second.origin}/api/auth/session`, {
    headers: { cookie: adminCookie },
  });
  const sessions = await sessionsResponse.json() as {
    currentSession: { id: string };
    sessions: Array<{ id: string; transport: string; clientKind: string }>;
  };
  const browserSession = sessions.sessions.find((session) => (
    session.id !== sessions.currentSession.id
    && session.transport === "bearer"
    && session.clientKind === "browser"
  ));
  expect(browserSession).toBeTruthy();
  await second.revokeSession(browserSession!.id);

  await expect(page.getByText("Authorization required", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const reauthPopupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Authorize again" }).click();
  const reauthPopup = await reauthPopupPromise;
  await reauthPopup.locator("#authorization-password").fill(second.options.password);
  await reauthPopup.getByRole("button", { name: "Authorize", exact: true }).click();
  await reauthPopup.waitForEvent("close");
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Online/, {
    timeout: 30_000,
  });

  await second.stop();
  await expect(page.getByText(/Runner is stopping|Offline/)).toBeVisible({
    timeout: 30_000,
  });
  await second.start(Number(new URL(second.origin).port));
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Online/, {
    timeout: 30_000,
  });
  await page.reload();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(
    /Runner Two.*Online/,
    { timeout: 30_000 },
  );

  expect(uncaught).toEqual([]);
});

test("detects a runner rekey and replays terminal output after detach", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const [, second] = runners;
  await login(page, runners[0]);
  await connectRunner(page, second);

  const token = await second.issueBrowserToken(runners[0].origin);
  const authorization = `Bearer ${token.token}`;
  const create = await fetch(`${second.origin}/api/terminals`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      origin: runners[0].origin,
    },
    body: JSON.stringify({ cols: 80, rows: 24 }),
  });
  expect(create.ok).toBe(true);
  const { terminalId } = await create.json() as { terminalId: string };
  const ticketResponse = await fetch(`${second.origin}/api/auth/stream-ticket`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      origin: runners[0].origin,
    },
    body: JSON.stringify({ path: `/api/terminals/${terminalId}/stream` }),
  });
  const { ticket } = await ticketResponse.json() as { ticket: string };
  const firstStreamAbort = new AbortController();
  const firstStream = await fetch(
    `${second.origin}/api/terminals/${terminalId}/stream?ticket=${encodeURIComponent(ticket)}`,
    {
      headers: { origin: runners[0].origin },
      signal: firstStreamAbort.signal,
    },
  );
  expect(firstStream.ok).toBe(true);
  const firstReader = firstStream.body!.getReader();
  const firstFrame = new TextDecoder().decode((await firstReader.read()).value);
  expect(firstFrame).toContain("event: connected");
  firstStreamAbort.abort();

  const marker = `terminal-replay-${Date.now()}`;
  await fetch(`${second.origin}/api/terminals/${terminalId}/input`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      origin: runners[0].origin,
    },
    body: JSON.stringify({ data: `printf '${marker}\\n'\n` }),
  });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const replayTicketResponse = await fetch(`${second.origin}/api/auth/stream-ticket`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      origin: runners[0].origin,
    },
    body: JSON.stringify({ path: `/api/terminals/${terminalId}/stream` }),
  });
  const replayTicket = await replayTicketResponse.json() as { ticket: string };
  const replayAbort = new AbortController();
  const replayStream = await fetch(
    `${second.origin}/api/terminals/${terminalId}/stream?ticket=${encodeURIComponent(replayTicket.ticket)}&lastEventId=0`,
    {
      headers: { origin: runners[0].origin },
      signal: replayAbort.signal,
    },
  );
  const replayText = new TextDecoder();
  let output = "";
  const replayReader = replayStream.body!.getReader();
  while (!output.includes(marker)) {
    const result = await replayReader.read();
    if (result.done) break;
    output += replayText.decode(result.value);
  }
  replayAbort.abort();
  expect(output).toContain(marker);

  const rekeyed = await second.rekey();
  await expect(page.getByText("Runner identity changed", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Review identity" }).click();
  await expect(page.getByRole("dialog", { name: "Review runner identity" })).toContainText(
    rekeyed.runner.runnerInstanceId,
  );

  await fetch(`${second.origin}/api/terminals/${terminalId}`, {
    method: "DELETE",
    headers: {
      authorization,
      origin: runners[0].origin,
    },
  });
});
