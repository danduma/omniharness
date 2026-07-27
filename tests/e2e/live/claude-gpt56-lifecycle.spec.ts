import fs from "node:fs";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";
import {
  addProjectThroughFolderPicker,
  captureVisibleConversation,
  deleteOwnedConversationThroughUi,
  expectAppShellReady,
  expectClaudeGpt56LowForSelectedRun,
  expectConversationsTerminalInUi,
  expectConversationTranscriptOwnership,
  expectOwnedConversationCatalog,
  expectWorkspaceReady,
  queueAndInterruptConversation,
  reconnectBrowserNetwork,
  removeOwnedProjectThroughUi,
  restoreCodexDefaults,
  sendFollowUp,
  selectClaudeGpt56Low,
  setMinimumFreeDiskThroughUi,
  startOwnedConversation,
  stopConversation,
  switchToConversation,
  waitForConversationActive,
  waitForConversationTerminal,
} from "./omniharness-ui";
import {
  assertClaudeGatewayReady,
  fetchCanonicalSnapshot,
  fetchClaudeGatewayStatus,
  fetchOwnedNamedEvents,
  fetchWorkerEntries,
  isWorkerSettledNamedEvent,
  type NamedEventRecord,
} from "./control-plane-oracle";
import { appendLiveCheckpointDurably, stableTextHash } from "./checkpoint-reporter";
import {
  createLiveJourneyProject,
  resolveLiveJourneyProjectRoot,
  type LiveJourneyProjectFixture,
} from "./project-fixture";
import {
  assertManifestOwnsRun,
  assertOwnedTempProject,
  assertProjectMarkerMatches,
  readLiveJourneyManifest,
} from "./safety";

const PROMPT_A = `Work only inside the current project directory. Do not use the network, install packages, commit, create branches, or modify files outside this project.

Build a small dependency-free browser app named Research Relay using exactly index.html, styles.css, app.js, and README.md. It must support adding research notes, tags, filtering, localStorage persistence, and a visible checklist of persistent note-review tasks with checkboxes. Give it a clear accessible interface. Keep the implementation compact and proceed without questions.

Do not invoke skills or subagents. Do not launch a browser, web server, background process, or blocking task. Validate only by inspecting the four files and running node --check app.js, then finish the turn.`;

const INTERRUPT_A = "Change direction: use a warm amber theme, add Export JSON, and continue from the work already completed. Do not restart or duplicate files.";

const APPROVE_A = "Approved. Make any necessary final fixes to the four specified app files, including the amber theme and Export JSON change. Do not invoke skills, start a server, or run background tasks. Validate with node --check app.js and finish without questions.";

const PROMPT_B = `Work only inside the current project directory. Do not use the network, install packages, commit, create branches, or modify files outside this project.

Inspect the Research Relay app carefully, perform an accessibility and usability audit, and write AUDIT.md with exactly five numbered, prioritized findings. Cite concrete elements from the existing files and validate that AUDIT.md contains exactly five findings. Do not modify the app. Do not invoke skills, start a server, or run background tasks.`;

const RESUME_B = "Resume this session. Finish AUDIT.md only, using the existing context and files. Do not modify the app.";

const PROMPT_C = `Work only inside the current project directory. Do not use the network, install packages, commit, create branches, or modify files outside this project.

Inspect the current project and write STATUS.md with a concise file inventory and validation summary. Do not modify the app or AUDIT.md. Verify STATUS.md before completing. Do not invoke skills, start a server, or run background tasks.`;

type SnapshotRecord = Record<string, unknown>;

function records(value: unknown): SnapshotRecord[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is SnapshotRecord => Boolean(entry) && typeof entry === "object")
    : [];
}

function ownedSnapshotSummary(body: Record<string, unknown>, ownedRunIds: string[]): Record<string, unknown> {
  const owned = new Set(ownedRunIds);
  return {
    snapshotRunId: body.snapshotRunId ?? null,
    runs: records(body.runs)
      .filter((run) => typeof run.id === "string" && owned.has(run.id))
      .map((run) => ({
        id: run.id,
        status: run.status,
        preferredWorkerType: run.preferredWorkerType,
        preferredWorkerModel: run.preferredWorkerModel,
        preferredWorkerEffort: run.preferredWorkerEffort,
      })),
    workers: records(body.workers)
      .filter((worker) => typeof worker.runId === "string" && owned.has(worker.runId))
      .map((worker) => ({ id: worker.id, runId: worker.runId, type: worker.type, status: worker.status })),
    queuedMessages: records(body.queuedMessages)
      .filter((message) => typeof message.runId === "string" && owned.has(message.runId))
      .map((message) => ({ id: message.id, runId: message.runId, status: message.status })),
    workerEntrySeqs: body.workerEntrySeqs ?? {},
  };
}

async function recordCheckpoint(args: {
  page: Page;
  request: APIRequestContext;
  fixture: LiveJourneyProjectFixture;
  step: string;
  runId?: string;
}): Promise<{ anchor: number; body: Record<string, unknown> }> {
  const visible = await captureVisibleConversation(args.page);
  const snapshot = await fetchCanonicalSnapshot(args.request, args.runId);
  const manifest = readLiveJourneyManifest(args.fixture.manifestPath);
  appendLiveCheckpointDurably(path.join(path.dirname(args.fixture.manifestPath), `${manifest.journeyId}-checkpoints.jsonl`), {
    step: args.step,
    timestamp: new Date().toISOString(),
    runId: args.runId ?? visible.selectedRunId,
    visible: {
      selectedRunId: visible.selectedRunId,
      url: visible.url,
      rows: visible.ownedRows
        .filter((row) => manifest.runs.some((run) => run.id === row.runId))
        .map((row) => ({ runId: row.runId, active: row.active, textHash: stableTextHash(row.text) })),
      transcriptHash: stableTextHash(visible.transcriptText),
      stopVisible: visible.stopVisible,
      queuedVisible: visible.queuedVisible,
    },
    server: {
      anchor: snapshot.anchor,
      ...ownedSnapshotSummary(snapshot.body, manifest.runs.map((run) => run.id)),
    },
    mismatch: null,
  });
  return snapshot;
}

async function assertPersistedClaudeSelection(
  request: APIRequestContext,
  runIds: string[],
): Promise<void> {
  for (const runId of runIds) {
    const snapshot = await fetchCanonicalSnapshot(request, runId);
    const run = records(snapshot.body.runs).find((candidate) => candidate.id === runId);
    expect(run, `missing persisted run ${runId}`).toBeTruthy();
    expect(run?.preferredWorkerType).toBe("claude");
    expect(run?.preferredWorkerModel).toBe("cliproxyapi:gpt-5.6-sol");
    expect(run?.preferredWorkerEffort).toBe("low");
  }
}

async function assertActiveClaudeRuntimeSelection(
  request: APIRequestContext,
  runId: string,
): Promise<void> {
  const snapshot = await fetchCanonicalSnapshot(request, runId);
  const worker = records(snapshot.body.workers).find((candidate) => candidate.runId === runId);
  expect(worker, `missing active worker for ${runId}`).toBeTruthy();
  const runtimeResponse = await request.get(
    `${process.env.OMNIHARNESS_BRIDGE_URL?.trim() || "http://127.0.0.1:7800"}/agents`,
  );
  expect(runtimeResponse.ok(), `live agent runtime read failed for ${runId}`).toBe(true);
  const agent = records(await runtimeResponse.json()).find((candidate) => candidate.name === worker?.id);
  expect(agent, `missing live agent for ${runId}`).toBeTruthy();
  expect(agent?.requestedModel).toBe("gpt-5.6-sol");
  expect(agent?.effectiveModel).toBe("gpt-5.6-sol");
  expect(agent?.requestedEffort).toBe("low");
  expect(agent?.effectiveEffort).toBe("low");

  const entries = (await fetchWorkerEntries(request, String(worker?.id))).entries;
  const effortValues = entries
    .filter((entry) => entry.type === "config_option")
    .flatMap((entry) => records((entry.raw as Record<string, unknown> | undefined)?.configOptions))
    .filter((option) => option.id === "effort")
    .map((option) => option.currentValue);
  expect(effortValues).toContain("low");
}

async function assertWorkerStreamInputs(args: {
  request: APIRequestContext;
  runId: string;
  expectedInput: string;
}): Promise<void> {
  const snapshot = await fetchCanonicalSnapshot(args.request, args.runId);
  const workers = records(snapshot.body.workers).filter((worker) => worker.runId === args.runId);
  expect(workers.length).toBeGreaterThan(0);
  const entries = (await Promise.all(workers.map(async (worker) => {
    expect(typeof worker.id).toBe("string");
    return (await fetchWorkerEntries(args.request, String(worker.id))).entries;
  }))).flat();
  expect(entries.filter((entry) => entry.type === "user_input" && entry.text === args.expectedInput)).toHaveLength(1);
}

async function assertWorkerStreamsConfirmedLowEffort(args: {
  request: APIRequestContext;
  runId: string;
}): Promise<void> {
  const snapshot = await fetchCanonicalSnapshot(args.request, args.runId);
  const workers = records(snapshot.body.workers).filter((worker) => worker.runId === args.runId);
  expect(workers.length).toBeGreaterThan(0);
  for (const worker of workers) {
    const entries = (await fetchWorkerEntries(args.request, String(worker.id))).entries;
    const confirmedEfforts = entries
      .filter((entry) => entry.type === "config_option")
      .flatMap((entry) => records((entry.raw as Record<string, unknown> | undefined)?.configOptions))
      .filter((option) => option.id === "effort")
      .map((option) => option.currentValue);
    expect(confirmedEfforts, `worker ${String(worker.id)} never confirmed low effort`).toContain("low");
  }
}

async function cleanupOwnedJourney(args: {
  page: Page;
  request: APIRequestContext;
  fixture: LiveJourneyProjectFixture;
  testInfo: TestInfo;
}): Promise<void> {
  const manifest = readLiveJourneyManifest(args.fixture.manifestPath);
  const cleanupFailures: string[] = [];

  for (const run of [...manifest.runs].reverse()) {
    assertManifestOwnsRun(manifest, run.id);
    try {
      await deleteOwnedConversationThroughUi(args.page, run.id);
    } catch (error) {
      const response = await args.request.delete(`/api/runs/${encodeURIComponent(run.id)}`);
      if (response.status() !== 404 && !response.ok()) {
        cleanupFailures.push(`${run.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  try {
    await removeOwnedProjectThroughUi(args.page, manifest.projectPath);
  } catch (error) {
    cleanupFailures.push(`project registration: ${error instanceof Error ? error.message : String(error)}`);
  }

  const snapshot = await fetchCanonicalSnapshot(args.request);
  const remainingRunIds = new Set(records(snapshot.body.runs).map((run) => run.id));
  for (const run of manifest.runs) {
    if (remainingRunIds.has(run.id)) cleanupFailures.push(`${run.id}: still present after cleanup`);
  }

  if (cleanupFailures.length > 0) {
    await args.testInfo.attach("live-cleanup-failures", {
      body: cleanupFailures.join("\n"),
      contentType: "text/plain",
    });
    throw new Error(`Targeted live cleanup was incomplete: ${cleanupFailures.join("; ")}`);
  }

  assertProjectMarkerMatches(manifest.projectPath, manifest);
  fs.rmSync(manifest.projectPath, { recursive: true, force: true });
}

test("live preflight exposes Claude Code with GPT-5.6 SOL at low effort", async ({ page, request }) => {
  await page.goto("/");
  await expectWorkspaceReady(page);
  assertClaudeGatewayReady(await fetchClaudeGatewayStatus(request));
  await selectClaudeGpt56Low(page);

  await expect(page.getByRole("combobox", { name: "CLI harness", exact: true })).toHaveValue("claude");
  await expect(page.getByRole("combobox", { name: "Worker model", exact: true })).toHaveValue("cliproxyapi:gpt-5.6-sol");
  await expect(page.getByRole("combobox", { name: "Worker effort", exact: true })).toHaveValue("Low");

  await restoreCodexDefaults(page);
});

test("Claude Code with GPT-5.6 survives a real three-session lifecycle journey", async ({ page, request, context }, testInfo) => {
  const journeyId = `claude-gpt56-${Date.now().toString(36)}`;
  const journeyRoot = resolveLiveJourneyProjectRoot(process.cwd());
  const fixture = createLiveJourneyProject({
    journeyId,
    manifestRoot: testInfo.outputPath("manifests"),
    tempRoot: journeyRoot,
  });
  assertOwnedTempProject({
    projectPath: fixture.projectPath,
    repoRoot: process.cwd(),
    tempRoot: journeyRoot,
  });

  let baselineAnchor = 0;
  let eventCursor = 0;
  const observedNamedEvents = new Map<number, NamedEventRecord>();
  let journeyFailure: unknown = null;
  let originalMinimumFreeDiskMb: number | null = null;
  try {
    await page.goto("/");
    await expectWorkspaceReady(page);
    assertClaudeGatewayReady(await fetchClaudeGatewayStatus(request));
    originalMinimumFreeDiskMb = await setMinimumFreeDiskThroughUi(page, 4096);
    baselineAnchor = (await fetchCanonicalSnapshot(request)).anchor;
    eventCursor = baselineAnchor;
    await addProjectThroughFolderPicker(page, fixture.projectPath);

    const collectNamedEvents = async () => {
      const fresh = await fetchOwnedNamedEvents(
        request,
        readLiveJourneyManifest(fixture.manifestPath),
        eventCursor,
      );
      for (const record of fresh) observedNamedEvents.set(record.id, record);
      if (fresh.length > 0) eventCursor = Math.max(eventCursor, ...fresh.map((record) => record.id));
    };

    const runA = await startOwnedConversation({
      page,
      projectPath: fixture.projectPath,
      manifestPath: fixture.manifestPath,
      label: "A",
      prompt: PROMPT_A,
    });
    await waitForConversationActive(page, runA);
    await assertActiveClaudeRuntimeSelection(request, runA);
    await recordCheckpoint({ page, request, fixture, step: "A-working", runId: runA });
    await collectNamedEvents();

    const runB = await startOwnedConversation({
      page,
      projectPath: fixture.projectPath,
      manifestPath: fixture.manifestPath,
      label: "B",
      prompt: PROMPT_B,
    });
    await waitForConversationActive(page, runB);
    await assertActiveClaudeRuntimeSelection(request, runB);
    await expectOwnedConversationCatalog(page, [runA, runB]);
    await expectConversationTranscriptOwnership({
      page,
      runId: runA,
      includes: ["Research Relay"],
      excludes: ["exactly five numbered"],
    });
    await expectClaudeGpt56LowForSelectedRun(page, runA);

    await queueAndInterruptConversation(page, runA, INTERRUPT_A);
    await recordCheckpoint({ page, request, fixture, step: "A-interrupt-accepted", runId: runA });

    await expectConversationTranscriptOwnership({
      page,
      runId: runB,
      includes: ["exactly five numbered"],
      excludes: ["adding research notes"],
    });
    await expectClaudeGpt56LowForSelectedRun(page, runB);
    await recordCheckpoint({ page, request, fixture, step: "A-B-switch-stable", runId: runB });
    await collectNamedEvents();

    await stopConversation(page, runB);
    await recordCheckpoint({ page, request, fixture, step: "B-stopped", runId: runB });
    await collectNamedEvents();

    await sendFollowUp(page, runB, RESUME_B);
    await recordCheckpoint({ page, request, fixture, step: "B-resumed", runId: runB });
    await collectNamedEvents();

    await waitForConversationTerminal(page, runA);
    await recordCheckpoint({ page, request, fixture, step: "A-design-turn-completed", runId: runA });
    await collectNamedEvents();
    await sendFollowUp(page, runA, APPROVE_A);
    await recordCheckpoint({ page, request, fixture, step: "A-approved", runId: runA });

    const runC = await startOwnedConversation({
      page,
      projectPath: fixture.projectPath,
      manifestPath: fixture.manifestPath,
      label: "C",
      prompt: PROMPT_C,
    });
    await waitForConversationActive(page, runC);
    await assertActiveClaudeRuntimeSelection(request, runC);
    await expectOwnedConversationCatalog(page, [runA, runB, runC]);
    await recordCheckpoint({ page, request, fixture, step: "C-working", runId: runC });

    await waitForConversationTerminal(page, runC);
    await recordCheckpoint({ page, request, fixture, step: "C-completed", runId: runC });
    await collectNamedEvents();
    await waitForConversationTerminal(page, runA);
    await recordCheckpoint({ page, request, fixture, step: "A-completed", runId: runA });
    await collectNamedEvents();
    await waitForConversationTerminal(page, runB);
    await recordCheckpoint({ page, request, fixture, step: "B-completed", runId: runB });
    await collectNamedEvents();

    for (const runId of [runA, runC, runB, runA]) {
      await switchToConversation(page, runId);
      await expectClaudeGpt56LowForSelectedRun(page, runId);
      await expectOwnedConversationCatalog(page, [runA, runB, runC]);
      await expectConversationsTerminalInUi(page, [runA, runB, runC]);
    }
    await recordCheckpoint({ page, request, fixture, step: "terminal-switch-loop", runId: runA });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expectAppShellReady(page);
    await expect(page).toHaveURL(new RegExp(`/session/${runA}/?$`));
    await expectConversationTranscriptOwnership({ page, runId: runA, includes: [INTERRUPT_A] });
    await recordCheckpoint({ page, request, fixture, step: "reloaded", runId: runA });

    await reconnectBrowserNetwork(context, page);
    for (const runId of [runC, runB, runA]) {
      await switchToConversation(page, runId);
      await expectOwnedConversationCatalog(page, [runA, runB, runC]);
    }
    await recordCheckpoint({ page, request, fixture, step: "reconnected", runId: runA });

    await expectConversationTranscriptOwnership({
      page,
      runId: runA,
      includes: ["Research Relay", INTERRUPT_A, APPROVE_A],
      excludes: [RESUME_B, "write STATUS.md"],
    });
    await expectConversationTranscriptOwnership({
      page,
      runId: runB,
      includes: ["AUDIT.md", RESUME_B],
      excludes: [INTERRUPT_A, "write STATUS.md"],
    });
    await expectConversationTranscriptOwnership({
      page,
      runId: runC,
      includes: ["write STATUS.md"],
      excludes: [INTERRUPT_A, RESUME_B],
    });

    const expectedFiles = ["index.html", "styles.css", "app.js", "README.md", "AUDIT.md", "STATUS.md"];
    for (const fileName of expectedFiles) {
      expect(fs.existsSync(path.join(fixture.projectPath, fileName)), `${fileName} was not created`).toBe(true);
    }
    expect(fs.readFileSync(path.join(fixture.projectPath, "styles.css"), "utf8")).toMatch(/amber|#f59e0b|#d97706|#b45309/i);
    const appScript = fs.readFileSync(path.join(fixture.projectPath, "app.js"), "utf8");
    expect(appScript).toMatch(/JSON\.stringify\s*\(/);
    expect(appScript).toMatch(/application\/json/i);
    expect(appScript).toMatch(/\.download\s*=/);
    const audit = fs.readFileSync(path.join(fixture.projectPath, "AUDIT.md"), "utf8");
    expect(audit.match(/^\s*[1-5][.)]\s+/gm)).toHaveLength(5);

    const runIds = [runA, runB, runC];
    await assertPersistedClaudeSelection(request, runIds);
    await assertWorkerStreamInputs({ request, runId: runA, expectedInput: INTERRUPT_A });
    await assertWorkerStreamInputs({ request, runId: runA, expectedInput: APPROVE_A });
    await assertWorkerStreamInputs({ request, runId: runB, expectedInput: RESUME_B });
    for (const runId of runIds) await assertWorkerStreamsConfirmedLowEffort({ request, runId });
    await collectNamedEvents();
    const events = [...observedNamedEvents.values()];
    for (const runId of runIds) {
      expect(
        events.some((record) => record.runId === runId && record.event.kind === "worker.spawned"),
        `run ${runId} never emitted worker.spawned`,
      ).toBe(true);
      expect(
        events.some((record) => record.runId === runId && isWorkerSettledNamedEvent(record)),
        `run ${runId} never emitted a settled worker decision`,
      ).toBe(true);
    }
    expect(events.some((record) => (
      record.runId === runB
      && record.event.kind === "worker.terminal"
      && record.event.status === "cancelled"
    )), `stopped run ${runB} never emitted worker.terminal`).toBe(true);
    expect(events.some((record) => record.runId === runA && record.event.kind === "queue.interrupt_delivery_finished")).toBe(true);
    expect(events.some((record) => record.runId === runB && (
      record.event.kind === "worker.reattached" || record.event.kind === "worker.recreated"
    ))).toBe(true);
    await recordCheckpoint({ page, request, fixture, step: "verified", runId: runC });
  } catch (error) {
    journeyFailure = error;
    throw error;
  } finally {
    let finalizationError: unknown = null;
    if (fs.existsSync(fixture.manifestPath) && fs.existsSync(fixture.projectPath)) {
      try {
        await cleanupOwnedJourney({ page, request, fixture, testInfo });
      } catch (cleanupError) {
        await testInfo.attach("live-cleanup-error", {
          body: cleanupError instanceof Error ? cleanupError.stack ?? cleanupError.message : String(cleanupError),
          contentType: "text/plain",
        });
        finalizationError = cleanupError;
      }
    }
    if (originalMinimumFreeDiskMb !== null) {
      try {
        await page.goto("/");
        await expectAppShellReady(page);
        await setMinimumFreeDiskThroughUi(page, originalMinimumFreeDiskMb);
      } catch (restoreError) {
        await testInfo.attach("live-settings-restore-error", {
          body: restoreError instanceof Error ? restoreError.stack ?? restoreError.message : String(restoreError),
          contentType: "text/plain",
        });
        finalizationError ??= restoreError;
      }
    }
    if (journeyFailure === null && finalizationError !== null) throw finalizationError;
  }
});
