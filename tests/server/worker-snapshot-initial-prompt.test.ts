import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { db } from "@/server/db";
import {
  clarifications,
  conversationReadMarkers,
  creditEvents,
  executionEvents,
  messages,
  planItems,
  planningReviewFindings,
  planningReviewRounds,
  planningReviewRuns,
  plans,
  processSessions,
  queuedConversationMessages,
  recoveryIncidents,
  runs,
  settings,
  supervisorInterventions,
  supervisorScheduledWakes,
  workerAssignments,
  workerCounters,
  workers,
} from "@/server/db/schema";
import { __resetTitleMissReportingForTests, persistWorkerSnapshot } from "@/server/workers/snapshots";
import { __resetOutputStoreCachesForTests, readWorkerOutputEntries } from "@/server/workers/output-store";
import { __resetAgentTranscriptTitleCacheForTests } from "@/server/conversations/agent-transcript-title";
import { buildInitialConversationTitle } from "@/server/conversations/initial-title";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

describe("persistWorkerSnapshot initial direct prompt ordering", () => {
  beforeEach(async () => {
    __resetOutputStoreCachesForTests();
    __resetNamedEventsForTests();
    __resetTitleMissReportingForTests();
    await db.delete(planningReviewFindings);
    await db.delete(planningReviewRounds);
    await db.delete(planningReviewRuns);
    await db.delete(supervisorScheduledWakes);
    await db.delete(supervisorInterventions);
    await db.delete(executionEvents);
    await db.delete(workerAssignments);
    await db.delete(clarifications);
    await db.delete(recoveryIncidents);
    await db.delete(queuedConversationMessages);
    await db.delete(messages);
    await db.delete(processSessions);
    await db.delete(creditEvents);
    await db.delete(workers);
    await db.delete(workerCounters);
    await db.delete(conversationReadMarkers);
    await db.delete(runs);
    await db.delete(planItems);
    await db.delete(plans);
    await db.delete(settings);
  });

  afterEach(() => {
    __resetOutputStoreCachesForTests();
  });

  it("seeds the initial direct user prompt before bridge output entries", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const messageId = randomUUID();
    const initialPrompt = "Group all currently modified files into logical git commits.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/test.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "gemini",
      status: "working",
      cwd: "/workspace",
      initialPrompt,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(messages).values({
      id: messageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: initialPrompt,
      createdAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Worker response",
      outputEntries: [
        {
          id: "bridge-entry",
          type: "message",
          text: "Worker response",
          timestamp: new Date(1000).toISOString(),
        },
      ],
    });

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((entry) => ({ id: entry.id, type: entry.type, text: entry.text, seq: (entry as { seq?: number }).seq }))).toEqual([
      { id: messageId, type: "user_input", text: initialPrompt, seq: 1 },
      { id: "bridge-entry", type: "message", text: "Worker response", seq: 2 },
    ]);
  });

  // Claude Code records the title it generated in its own session transcript,
  // keyed by the session id OmniHarness already stores as
  // `workers.bridgeSessionId`. Before this, the conversation kept the title
  // derived from the user's first message however good the agent's was.
  it("adopts the title Claude Code recorded in its session transcript", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const sessionId = randomUUID();
    const configDir = mkdtempSync(join(tmpdir(), "omni-claude-home-"));
    const cwd = "/workspace/app";
    const projectDir = join(configDir, "projects", cwd.replace(/\//g, "-"));
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(
      join(projectDir, `${sessionId}.jsonl`),
      `${JSON.stringify({ type: "ai-title", aiTitle: "Debug duplicate sent message race condition", sessionId })}\n`,
    );
    vi.stubEnv("CLAUDE_CONFIG_DIR", mkdtempSync(join(tmpdir(), "omni-wrong-claude-home-")));
    __resetAgentTranscriptTitleCacheForTests();

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/transcript-title.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Sometimes I Send A Message And",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd,
      bridgeSessionId: sessionId,
      initialPrompt: "",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "",
      claudeConfigDir: configDir,
      outputEntries: [
        {
          id: "bridge-entry-title",
          type: "message",
          text: "Worker response",
          timestamp: new Date(1000).toISOString(),
        },
      ],
    });

    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe("Debug duplicate sent message race condition");
    vi.unstubAllEnvs();
  });

  it("keeps the initial title and reports the miss when the CLI names nothing", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const initialPrompt = "Investigate why conversation titles never load after the first agent response.";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/generated-title.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: buildInitialConversationTitle(initialPrompt),
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace",
      initialPrompt,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: initialPrompt,
      createdAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "The provider title channels are empty, so I traced the fallback path.",
      outputEntries: [],
    });

    // No model is asked to invent one: the conversation keeps the first line
    // of what the user typed, which is what the sidebar already showed.
    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe(buildInitialConversationTitle(initialPrompt));

    const emitted = getNamedEventsSince(0).events.map((entry) => entry.event);
    expect(emitted).toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_sources_missing",
        runId,
        workerId,
        fallback: "initial_title",
      }),
    );
    expect(emitted).not.toContainEqual(
      expect.objectContaining({ kind: "conversation.title_updated", runId }),
    );
  });

  it("reports the miss once however many snapshots the worker persists", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const initialPrompt = "Fix Bug";

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/idempotent-title.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: initialPrompt,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace",
      initialPrompt,
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: "checkpoint",
      content: initialPrompt,
      createdAt: new Date(0),
    });
    const snapshot = {
      currentText: "",
      lastText: "I found and fixed the bug.",
      outputEntries: [{
        id: "assistant-reply",
        type: "message" as const,
        text: "I found and fixed the bug.",
        timestamp: new Date(1000).toISOString(),
      }],
    };

    await persistWorkerSnapshot(workerId, snapshot);
    await persistWorkerSnapshot(workerId, snapshot);

    const sourceMisses = getNamedEventsSince(0).events
      .map((entry) => entry.event)
      .filter((event) => event.kind === "conversation.title_sources_missing" && event.runId === runId);
    expect(sourceMisses).toHaveLength(1);
  });

  // The agent reports its own session title over ACP. It used to be appended
  // to the worker output and never read, leaving the conversation stuck with
  // the title derived from the user's first message.
  it("adopts the session title the agent reported", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;

    await db.insert(plans).values({
      id: planId,
      path: "vibes/ad-hoc/title.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: "Sometimes I Send A Message And",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "claude",
      status: "working",
      cwd: "/workspace",
      initialPrompt: "",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "",
      outputEntries: [
        {
          id: "session-info-entry",
          type: "session_info",
          text: "Duplicate sent-message race condition",
          timestamp: new Date(1000).toISOString(),
          raw: { title: "Duplicate sent-message race condition" },
        },
      ],
    });

    const run = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    expect(run?.title).toBe("Duplicate sent-message race condition");
  });

  it("does not seed initial prompts for implementation workers", async () => {
    const planId = randomUUID();
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;

    await db.insert(plans).values({
      id: planId,
      path: "docs/superpowers/plans/test.md",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "implementation",
      status: "running",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    await db.insert(workers).values({
      id: workerId,
      runId,
      type: "codex",
      status: "working",
      cwd: "/workspace",
      initialPrompt: "Supervisor worker prompt",
      outputLog: "",
      outputEntriesJson: "[]",
      currentText: "",
      lastText: "",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    await persistWorkerSnapshot(workerId, {
      currentText: "",
      lastText: "Worker response",
      outputEntries: [
        {
          id: "implementation-bridge-entry",
          type: "message",
          text: "Worker response",
          timestamp: new Date(1000).toISOString(),
        },
      ],
    });

    const entries = await readWorkerOutputEntries(runId, workerId);
    expect(entries.map((entry) => entry.type)).toEqual(["message"]);
  });
});
