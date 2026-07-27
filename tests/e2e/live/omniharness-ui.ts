import path from "node:path";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { recordOwnedRunDurably } from "./safety";
import type { LiveJourneyRunLabel } from "./types";

const RUN_PATH = /\/session\/([0-9a-f]{12}|[0-9a-f-]{36})\/?$/i;

function attributeSelector(name: string, value: string): string {
  return `[${name}="${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"]`;
}

function selectedRunId(page: Page): string | null {
  return new URL(page.url()).pathname.match(RUN_PATH)?.[1] ?? null;
}

function conversationRow(page: Page, runId: string): Locator {
  return page.locator(attributeSelector("data-conversation-run-id", runId));
}

function projectRow(page: Page, projectPath: string): Locator {
  return page.locator(attributeSelector("data-project-path", projectPath));
}

function composer(page: Page): Locator {
  return page.locator("form").filter({ has: page.locator('[data-composer-input="true"]') });
}

function conversationTranscript(page: Page): Locator {
  return page.getByTestId("conversation-transcript");
}

export async function expectWorkspaceReady(page: Page): Promise<void> {
  await expectAppShellReady(page);
  await expect(page.getByRole("combobox", { name: "CLI harness", exact: true })).toBeVisible();
}

export async function expectAppShellReady(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible({ timeout: 30_000 });
}

async function openRuntimeSettings(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("menuitem", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "OmniHarness Settings", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Runtime", exact: true }).click();
  return dialog;
}

export async function setMinimumFreeDiskThroughUi(page: Page, valueMb: number): Promise<number> {
  const dialog = await openRuntimeSettings(page);
  const input = dialog.getByRole("spinbutton", { name: /^Free disk MB\b/ });
  const previousValue = Number(await input.inputValue());
  if (!Number.isFinite(previousValue)) {
    throw new Error("Runtime settings did not expose a numeric free-disk limit.");
  }
  await input.fill(String(valueMb));
  const saveResponse = page.waitForResponse((response) => (
    response.url().endsWith("/api/settings")
    && response.request().method() === "POST"
  ));
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saveResponse).ok()).toBe(true);
  await expect(dialog).toBeHidden();
  return previousValue;
}

export async function selectClaudeGpt56Low(page: Page): Promise<void> {
  const harness = page.getByRole("combobox", { name: "CLI harness", exact: true });
  const model = page.getByRole("combobox", { name: "Worker model", exact: true });
  const effort = page.getByRole("combobox", { name: "Worker effort", exact: true });
  await expect(harness).toHaveCount(1);
  await harness.selectOption({ label: "Claude Code" });
  await expect(model).toHaveCount(1);
  await model.selectOption({ label: "GPT-5.6 SOL" });
  await expect(effort).toHaveCount(1);
  await effort.selectOption({ label: "Low" });
  await expect(harness).toHaveValue("claude");
  await expect(model).toHaveValue("cliproxyapi:gpt-5.6-sol");
  await expect(effort).toHaveValue("Low");
}

export async function expectClaudeGpt56LowForSelectedRun(page: Page, runId: string): Promise<void> {
  const row = conversationRow(page, runId);
  await expect(row.getByLabel("Direct control conversation", { exact: true })).toBeVisible();
  const selectedComposer = page.locator('form[data-selected-cli-harness="claude"]');
  await expect(selectedComposer).toHaveCount(1);
  await expect(selectedComposer).toHaveAttribute("data-selected-worker-model", "cliproxyapi:gpt-5.6-sol");
  await expect(selectedComposer).toHaveAttribute("data-selected-worker-effort", "Low");
}

export async function restoreCodexDefaults(page: Page): Promise<void> {
  const harness = page.getByRole("combobox", { name: "CLI harness", exact: true });
  const model = page.getByRole("combobox", { name: "Worker model", exact: true });
  const effort = page.getByRole("combobox", { name: "Worker effort", exact: true });
  await harness.selectOption({ label: "Codex" });
  await model.selectOption({ label: "GPT-5.5" });
  await effort.selectOption({ label: "High" });
}

export async function addProjectThroughFolderPicker(page: Page, projectPath: string): Promise<void> {
  const target = path.resolve(projectPath);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Select Project Folder", exact: true });
  await expect(dialog).toBeVisible();
  const currentPath = dialog.getByTestId("folder-picker-current-path");
  await expect(currentPath).not.toHaveText("Loading...", { timeout: 30_000 });

  for (let step = 0; step < 64; step += 1) {
    const current = path.resolve((await currentPath.getAttribute("title")) ?? "");
    if (current === target) break;
    const relative = path.relative(current, target);
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
      const next = path.join(current, relative.split(path.sep)[0]);
      const directory = dialog.locator(attributeSelector("data-folder-path", next));
      await expect(directory).toBeVisible({ timeout: 30_000 });
      await directory.click();
      await expect(currentPath).toHaveAttribute("title", next, { timeout: 30_000 });
    } else {
      const rawParent = await currentPath.getAttribute("data-parent-path");
      if (!rawParent) {
        throw new Error(`Folder picker cannot reach owned project ${target}.`);
      }
      const parent = path.resolve(rawParent);
      if (parent === current) {
        throw new Error(`Folder picker cannot reach owned project ${target}.`);
      }
      const parentButton = dialog.getByRole("button", { name: "..", exact: true });
      if (await parentButton.count() !== 1) {
        throw new Error(`Folder picker did not expose its declared parent ${parent}.`);
      }
      await parentButton.click();
      await expect(currentPath).toHaveAttribute("title", parent, { timeout: 30_000 });
    }
  }

  await expect(currentPath).toHaveAttribute("title", target);
  await dialog.getByRole("button", { name: "Select Current Folder", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(projectRow(page, target)).toBeVisible({ timeout: 30_000 });
}

export async function beginNewDirectConversation(page: Page, projectPath: string): Promise<void> {
  const row = projectRow(page, projectPath);
  await expect(row).toBeVisible();
  const projectName = path.basename(projectPath);
  await row.getByTitle(`New conversation in ${projectName}`, { exact: true }).click();
  await expect(page.getByRole("button", { name: "Direct control", exact: true })).toHaveAttribute("aria-pressed", "true");
  await selectClaudeGpt56Low(page);
}

export async function startOwnedConversation(args: {
  page: Page;
  projectPath: string;
  manifestPath: string;
  label: LiveJourneyRunLabel;
  prompt: string;
}): Promise<string> {
  await beginNewDirectConversation(args.page, args.projectPath);
  const input = args.page.locator('[data-composer-input="true"]');
  await input.fill(args.prompt);
  await args.page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => selectedRunId(args.page), { timeout: 30_000 }).not.toBeNull();
  const runId = selectedRunId(args.page);
  if (!runId) throw new Error("Conversation creation did not expose a run id in the selected URL.");

  recordOwnedRunDurably(args.manifestPath, {
    id: runId,
    label: args.label,
    createdAt: new Date().toISOString(),
  });

  await expect.poll(async () => {
    const response = await args.page.request.get(
      `/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`,
    );
    if (!response.ok()) return false;
    const snapshot = await response.json() as { runs?: Array<{ id?: string }> };
    return snapshot.runs?.some((run) => run.id === runId) === true;
  }, {
    timeout: 30_000,
    intervals: [250, 500, 1_000],
    message: `Conversation ${runId} was shown optimistically but never became server-visible.`,
  }).toBe(true);

  await expect(conversationRow(args.page, runId)).toBeVisible({ timeout: 30_000 });
  await expect(args.page).toHaveURL(new RegExp(`/session/${runId}/?$`));
  return runId;
}

export async function switchToConversation(page: Page, runId: string): Promise<void> {
  const row = conversationRow(page, runId);
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/session/${runId}/?$`), { timeout: 30_000 });
  await expect(row).toBeVisible();
}

export async function expectOwnedConversationCatalog(page: Page, runIds: string[]): Promise<void> {
  for (const runId of runIds) {
    await expect(conversationRow(page, runId)).toHaveCount(1);
    await expect(conversationRow(page, runId)).toBeVisible();
  }
}

export async function waitForConversationActive(page: Page, runId: string): Promise<void> {
  await switchToConversation(page, runId);
  await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeVisible({ timeout: 120_000 });
  await expect(conversationRow(page, runId).locator(".animate-spin")).toBeVisible({ timeout: 120_000 });
  await expect.poll(async () => {
    const response = await page.request.get(
      `/api/events?snapshot=1&persisted=1&runId=${encodeURIComponent(runId)}`,
    );
    if (!response.ok()) return false;
    const snapshot = await response.json() as {
      runs?: Array<{ id?: string; status?: string }>;
      workers?: Array<{ runId?: string; status?: string }>;
    };
    const run = snapshot.runs?.find((candidate) => candidate.id === runId);
    const workerIsWorking = snapshot.workers?.some((worker) => (
      worker.runId === runId && worker.status?.trim().toLowerCase() === "working"
    ));
    return run?.status === "running" && workerIsWorking === true;
  }, {
    timeout: 120_000,
    intervals: [250, 500, 1_000],
    message: `Conversation ${runId} never reached a persisted working state.`,
  }).toBe(true);
}

export async function queueAndInterruptConversation(page: Page, runId: string, content: string): Promise<void> {
  await waitForConversationActive(page, runId);
  const workerQuestion = page.getByRole("region", { name: "Worker question", exact: true });
  if (await workerQuestion.isVisible().catch(() => false)) {
    await workerQuestion.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(workerQuestion).toBeHidden({ timeout: 60_000 });
    await waitForConversationActive(page, runId);
  }
  const input = page.locator('[data-composer-input="true"]');
  await input.fill(content);
  const interruptResponse = page.waitForResponse((response) => (
    response.request().method() === "POST"
    && new URL(response.url()).pathname === `/api/conversations/${runId}/queued-messages/interrupt-next`
  ));
  await input.press("Escape");
  expect((await interruptResponse).ok()).toBe(true);
  await expect(conversationTranscript(page).getByText(content, { exact: true })).toHaveCount(1, { timeout: 60_000 });
}

export async function expectConversationsTerminalInUi(page: Page, runIds: string[]): Promise<void> {
  await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeHidden();
  for (const runId of runIds) {
    await expect(conversationRow(page, runId).locator(".animate-spin")).toBeHidden();
  }
}

export async function stopConversation(page: Page, runId: string): Promise<void> {
  await waitForConversationActive(page, runId);
  await page.getByRole("button", { name: "Stop conversation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeHidden({ timeout: 60_000 });
  await expect(conversationRow(page, runId).locator(".animate-spin")).toBeHidden({ timeout: 60_000 });
}

export async function sendFollowUp(page: Page, runId: string, content: string): Promise<void> {
  await switchToConversation(page, runId);
  await page.locator('[data-composer-input="true"]').fill(content);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(conversationTranscript(page).getByText(content, { exact: true })).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeVisible({ timeout: 120_000 });
}

export async function waitForConversationTerminal(page: Page, runId: string): Promise<void> {
  await switchToConversation(page, runId);
  const activeDeadline = Date.now() + 12 * 60_000;
  const noProgressDeadlineMs = 4 * 60_000;
  let lastProgressAt = Date.now();
  let previousFingerprint = "";
  let terminalObservedAt: number | null = null;

  while (Date.now() < activeDeadline) {
    const stopVisible = await page.getByRole("button", { name: "Stop conversation", exact: true })
      .isVisible()
      .catch(() => false);
    const spinnerVisible = await conversationRow(page, runId).locator(".animate-spin")
      .isVisible()
      .catch(() => false);
    const transcriptText = await conversationTranscript(page)
      .innerText()
      .catch(() => "");
    const fingerprint = `${stopVisible}:${spinnerVisible}:${transcriptText}`;
    if (fingerprint !== previousFingerprint) {
      previousFingerprint = fingerprint;
      lastProgressAt = Date.now();
    }
    if (!stopVisible && !spinnerVisible) {
      terminalObservedAt ??= Date.now();
      if (Date.now() - terminalObservedAt >= 2_000) return;
    } else {
      terminalObservedAt = null;
    }
    if (Date.now() - lastProgressAt >= noProgressDeadlineMs) {
      if (stopVisible) {
        await page.getByRole("button", { name: "Stop conversation", exact: true }).click();
        await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeHidden({ timeout: 60_000 });
      }
      throw new Error(`Conversation ${runId} made no visible progress for four minutes.`);
    }
    await page.waitForTimeout(1_000);
  }

  const stopVisible = await page.getByRole("button", { name: "Stop conversation", exact: true })
    .isVisible()
    .catch(() => false);
  if (stopVisible) {
    await page.getByRole("button", { name: "Stop conversation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop conversation", exact: true })).toBeHidden({ timeout: 60_000 });
  }
  throw new Error(`Conversation ${runId} exceeded the twelve-minute active-turn limit.`);
}

export async function expectConversationTranscriptOwnership(args: {
  page: Page;
  runId: string;
  includes: string[];
  excludes?: string[];
}): Promise<void> {
  await switchToConversation(args.page, args.runId);
  const transcript = conversationTranscript(args.page);
  for (const expected of args.includes) {
    await expect(transcript).toContainText(expected);
  }
  for (const excluded of args.excludes ?? []) {
    await expect(transcript).not.toContainText(excluded);
  }
}

export async function deleteOwnedConversationThroughUi(page: Page, runId: string): Promise<void> {
  const row = conversationRow(page, runId);
  if (await row.count() === 0) return;
  const actions = row.locator('button[aria-label^="Conversation actions for "]');
  await expect(actions).toHaveCount(1);
  await actions.click();
  const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(deleteItem).toHaveCount(1);
  await deleteItem.click();
  const dialog = page.getByRole("dialog", { name: "Delete Conversation", exact: true });
  await expect(dialog).toBeVisible();
  const confirm = dialog.getByRole("button", { name: "Delete", exact: true });
  await expect(confirm).toHaveCount(1);
  const deleteResponse = page.waitForResponse((response) => (
    response.request().method() === "DELETE"
    && new URL(response.url()).pathname === `/api/runs/${runId}`
  ));
  await confirm.click();
  expect((await deleteResponse).ok()).toBe(true);
  await expect(row).toBeHidden({ timeout: 60_000 });
}

export async function removeOwnedProjectThroughUi(page: Page, projectPath: string): Promise<void> {
  const row = projectRow(page, projectPath);
  if (await row.count() === 0) return;
  const actions = row.locator('[data-slot="dropdown-menu-trigger"]');
  await expect(actions).toHaveCount(1);
  await actions.click();
  const removeItem = page.getByRole("menuitem", { name: "Remove Project", exact: true });
  await expect(removeItem).toHaveCount(1);
  const settingsResponse = page.waitForResponse((response) => (
    response.url().endsWith("/api/settings")
    && response.request().method() === "POST"
  ));
  await removeItem.click();
  expect((await settingsResponse).ok()).toBe(true);
  await expect(row).toBeHidden({ timeout: 30_000 });
}

export async function captureVisibleConversation(page: Page): Promise<{
  selectedRunId: string | null;
  url: string;
  ownedRows: Array<{ runId: string; text: string; active: boolean }>;
  transcriptText: string;
  stopVisible: boolean;
  queuedVisible: boolean;
}> {
  const rows = page.locator("[data-conversation-run-id]");
  const ownedRows = await rows.evaluateAll((elements) => elements.map((element) => ({
    runId: element.getAttribute("data-conversation-run-id") ?? "",
    text: element.textContent?.trim() ?? "",
    active: Boolean(element.querySelector(".animate-spin")),
  })));
  return {
    selectedRunId: selectedRunId(page),
    url: page.url(),
    ownedRows,
    transcriptText: await conversationTranscript(page).innerText().catch(() => ""),
    stopVisible: await page.getByRole("button", { name: "Stop conversation", exact: true }).isVisible().catch(() => false),
    queuedVisible: await page.getByText("Queued messages", { exact: true }).isVisible().catch(() => false),
  };
}

export async function reconnectBrowserNetwork(context: BrowserContext, page: Page): Promise<void> {
  await context.setOffline(true);
  await page.waitForTimeout(1_500);
  const recoveredEventsResponse = page.waitForResponse((response) => (
    response.url().includes("/api/events")
    && response.ok()
  ), { timeout: 90_000 });
  await context.setOffline(false);
  await recoveredEventsResponse;
  await expect(page.getByRole("button", { name: "Add project", exact: true })).toBeVisible({ timeout: 60_000 });
}
