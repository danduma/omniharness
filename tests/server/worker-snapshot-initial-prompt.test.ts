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
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { __resetOutputStoreCachesForTests, readWorkerOutputEntries } from "@/server/workers/output-store";
import { __resetAgentTranscriptTitleCacheForTests } from "@/server/conversations/agent-transcript-title";

describe("persistWorkerSnapshot initial direct prompt ordering", () => {
  beforeEach(async () => {
    __resetOutputStoreCachesForTests();
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
    vi.stubEnv("CLAUDE_CONFIG_DIR", configDir);
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
