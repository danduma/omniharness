import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function connectRunner(page: Page, runner: RealRunnerHarness) {
  await page.locator("#runner-switcher").click();
  await page.getByText("Add server", { exact: true }).click();
  await page.locator("#runner-label").fill(runner.options.name);
  await page.locator("#runner-url").fill(runner.origin);
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const popup = await popupPromise;
  await popup.locator("#authorization-password").fill(runner.options.password);
  await popup.getByRole("button", { name: "Authorize", exact: true }).click();
  await popup.waitForEvent("close");
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(
    new RegExp(`${runner.options.name}.*Online`),
    { timeout: 30_000 },
  );
}

async function selectRunner(page: Page, name: string) {
  await page.locator("#runner-switcher").click();
  await page.getByRole("menuitem").filter({ hasText: name }).first().click();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(new RegExp(name));
}

async function postAsAdmin(runner: RealRunnerHarness, route: string, body: unknown) {
  const cookie = await runner.loginCookie();
  const response = await fetch(`${runner.origin}${route}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", origin: runner.origin },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${route} failed with ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function projectRow(scope: Page | Locator, projectPath: string) {
  return scope.locator(`[data-project-drag-row="true"][data-project-path="${projectPath}"]`);
}

test.beforeAll(async () => {
  runners = await startRunnerSet(["Runner One", "Runner Two"]);
});

test.afterAll(async () => {
  await disposeRunnerSet(runners);
  runners = [];
});

test("a project pinned on one server stays reachable while another server is selected", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const [first, second] = runners;
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));

  const alphaPath = path.join(first.root, "alpha-project");
  const betaPath = path.join(second.root, "beta-project");
  fs.mkdirSync(alphaPath, { recursive: true });
  fs.mkdirSync(betaPath, { recursive: true });
  await postAsAdmin(first, "/api/settings", { PROJECTS: JSON.stringify([alphaPath]) });
  await postAsAdmin(second, "/api/settings", { PROJECTS: JSON.stringify([betaPath]) });
  const created = await postAsAdmin(second, "/api/conversations", {
    mode: "implementation",
    command: "Pinned project acceptance conversation",
    projectPath: betaPath,
    preferredWorkerType: "codex",
    allowedWorkerTypes: ["codex"],
  });
  const runId = String(created.runId);

  await login(page, first);
  await connectRunner(page, second);

  const betaRow = projectRow(page, betaPath).first();
  await expect(betaRow).toBeVisible({ timeout: 30_000 });
  await betaRow.hover();
  await betaRow.getByRole("button", { name: "Pin beta-project" }).click();

  const pinned = page.getByRole("region", { name: "Pinned" });
  await expect(projectRow(pinned, betaPath)).toHaveCount(1);
  // Pinned projects move to the top instead of appearing twice.
  await expect(projectRow(page, betaPath)).toHaveCount(1);

  await selectRunner(page, "Runner One");
  await expect(projectRow(page, alphaPath)).toBeVisible({ timeout: 30_000 });
  const remoteBeta = pinned.locator(`[data-project-path="${betaPath}"]`);
  await expect(remoteBeta).toContainText("beta-project");
  // Pinned items name the machine they live on, with its connection status.
  await expect(remoteBeta.locator('[data-pinned-machine="Runner Two"]')).toBeVisible();
  const remoteRun = pinned.locator(`[data-conversation-run-id="${runId}"]`);
  await expect(remoteRun).toBeVisible({ timeout: 30_000 });
  // Actions that would land on the server on screen are not offered.
  await expect(remoteRun.getByRole("button", { name: /Conversation actions/ })).toHaveCount(0);

  await remoteRun.click();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Runner Two/, { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/session/${runId}$`));
  const localRun = pinned.locator(`[data-conversation-run-id="${runId}"]`);
  await expect(localRun).toHaveClass(/bg-\[#e2e1df\]/, { timeout: 30_000 });
  await expect(localRun.getByRole("button", { name: /Conversation actions/ })).toHaveCount(1);

  await page.reload();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Runner Two.*Online/, { timeout: 30_000 });
  await expect(pinned.locator(`[data-project-path="${betaPath}"]`)).toHaveCount(1, { timeout: 30_000 });

  await selectRunner(page, "Runner One");
  const remoteBetaAfterReload = pinned.locator(`[data-project-drag-row="true"][data-project-path="${betaPath}"]`);
  await remoteBetaAfterReload.hover();
  await remoteBetaAfterReload.getByRole("button", { name: "New conversation in beta-project" }).click();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Runner Two/, { timeout: 30_000 });
  await expect(page).toHaveURL(/\?project=/);

  const localBeta = pinned.locator(`[data-project-drag-row="true"][data-project-path="${betaPath}"]`);
  await localBeta.hover();
  await localBeta.getByRole("button", { name: "Unpin beta-project" }).click();
  await expect(pinned).toHaveCount(0);
  await expect(projectRow(page, betaPath)).toHaveCount(1);

  expect(uncaught).toEqual([]);
});

test("a session pinned on one server shows its machine and opens from another server", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const [first, second] = runners;
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));

  const gammaPath = path.join(second.root, "gamma-project");
  fs.mkdirSync(gammaPath, { recursive: true });
  await postAsAdmin(second, "/api/settings", {
    PROJECTS: JSON.stringify([path.join(second.root, "beta-project"), gammaPath]),
  });
  const created = await postAsAdmin(second, "/api/conversations", {
    mode: "implementation",
    command: "Pinned session acceptance conversation",
    projectPath: gammaPath,
    preferredWorkerType: "codex",
    allowedWorkerTypes: ["codex"],
  });
  const runId = String(created.runId);

  await login(page, first);
  await connectRunner(page, second);

  const runRow = page.locator(`[data-conversation-run-id="${runId}"]`);
  await expect(runRow).toHaveCount(1, { timeout: 30_000 });
  await runRow.hover();
  await runRow.getByRole("button", { name: "Pin session" }).click();

  const pinned = page.getByRole("region", { name: "Pinned" });
  const pinnedRun = pinned.locator(`[data-pinned-sessions="true"] [data-conversation-run-id="${runId}"]`);
  await expect(pinnedRun).toHaveCount(1);
  // Pinned sessions move to the top instead of appearing twice.
  await expect(runRow).toHaveCount(1);
  await expect(pinnedRun.locator('[data-pinned-machine="Runner Two"]')).toBeVisible();

  await selectRunner(page, "Runner One");
  await expect(pinnedRun).toHaveCount(1, { timeout: 30_000 });
  await expect(pinnedRun.locator('[data-pinned-machine="Runner Two"]')).toBeVisible();
  await expect(pinnedRun.getByRole("button", { name: /Conversation actions/ })).toHaveCount(0);

  await pinnedRun.click();
  await expect(page.locator("#runner-switcher")).toHaveAccessibleName(/Runner Two/, { timeout: 30_000 });
  await expect(page).toHaveURL(new RegExp(`/session/${runId}$`));
  await expect(pinnedRun).toHaveClass(/bg-\[#e2e1df\]/, { timeout: 30_000 });

  await pinnedRun.hover();
  await pinnedRun.getByRole("button", { name: "Unpin session" }).click();
  await expect(pinned).toHaveCount(0);
  await expect(projectRow(page, gammaPath)).toHaveCount(1);
  await expect(runRow).toHaveCount(1);

  expect(uncaught).toEqual([]);
});

test("on the mobile drawer, pins live in the overflow menu and the drawer clears the status bar", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const [first] = runners;
  const alphaPath = path.join(first.root, "alpha-project");
  fs.mkdirSync(alphaPath, { recursive: true });
  await postAsAdmin(first, "/api/settings", { PROJECTS: JSON.stringify([alphaPath]) });
  const created = await postAsAdmin(first, "/api/conversations", {
    mode: "implementation",
    command: "Mobile pin acceptance conversation",
    projectPath: alphaPath,
    preferredWorkerType: "codex",
    allowedWorkerTypes: ["codex"],
  });
  const runId = String(created.runId);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  // An installed edge-to-edge app reports the system bars as safe-area insets.
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 32, bottom: 24 } });
  const uncaught: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));

  await login(page, first);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.locator('[data-conversation-sidebar-surface="mobile"]');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveCSS("padding-top", "32px");
  await expect(drawer).toHaveCSS("padding-bottom", "24px");

  const runRow = drawer.locator(`[data-conversation-run-id="${runId}"]`);
  await expect(runRow).toHaveCount(1, { timeout: 30_000 });
  await expect(drawer.getByRole("button", { name: "Pin session" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Pin alpha-project" })).toHaveCount(0);

  await runRow.getByRole("button", { name: /Conversation actions/ }).click();
  await page.getByRole("menuitem", { name: "Pin session" }).click();
  const pinned = drawer.getByRole("region", { name: "Pinned" });
  await expect(pinned.locator(`[data-conversation-run-id="${runId}"]`)).toHaveCount(1);

  const alphaRow = drawer.locator(`[data-project-drag-row="true"][data-project-path="${alphaPath}"]`);
  await alphaRow.getByRole("button").last().click();
  await page.getByRole("menuitem", { name: "Pin alpha-project" }).click();
  await expect(pinned.locator(`[data-project-drag-row="true"][data-project-path="${alphaPath}"]`)).toHaveCount(1);

  const pinnedRun = pinned.locator(`[data-pinned-sessions="true"] [data-conversation-run-id="${runId}"]`);
  await pinnedRun.getByRole("button", { name: /Conversation actions/ }).click();
  await page.getByRole("menuitem", { name: "Unpin session" }).click();
  await expect(pinnedRun).toHaveCount(0);

  expect(uncaught).toEqual([]);
  await context.close();
});
