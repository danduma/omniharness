import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";
import {
  applyAgentSessionTitle,
  extractAgentSessionTitle,
  repairLeakedConversationTitles,
} from "@/server/conversations/agent-session-title";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";
import { buildTranscriptReplayPrompt } from "@/server/workers/session-recovery";

/**
 * `normalizeSessionUpdate` flattens an ACP `session_info_update` into
 * `{ type: "session_info", text: update.title ?? update.updatedAt ?? "", raw }`.
 * `text` is therefore ambiguous — it holds the timestamp when no title was
 * sent — so the title has to be read out of `raw`.
 */
function sessionInfoEntry(raw: Record<string, unknown>) {
  return {
    id: randomUUID(),
    type: "session_info" as const,
    text: String(raw.title ?? raw.updatedAt ?? ""),
    raw,
  };
}

describe("extractAgentSessionTitle", () => {
  it("reads the title the agent reported", () => {
    expect(extractAgentSessionTitle([
      sessionInfoEntry({ title: "Fix the duplicate message race" }),
    ])).toBe("Fix the duplicate message race");
  });

  it("takes the most recent title when the agent revises it", () => {
    expect(extractAgentSessionTitle([
      sessionInfoEntry({ title: "First guess" }),
      sessionInfoEntry({ title: "Better title" }),
    ])).toBe("Better title");
  });

  it("ignores a session update that carries only a timestamp", () => {
    // The flattened `text` would be the ISO timestamp here. Adopting it would
    // put a date in the sidebar where the title belongs.
    expect(extractAgentSessionTitle([
      sessionInfoEntry({ updatedAt: "2026-08-05T12:00:00.000Z" }),
    ])).toBeNull();
  });

  it("keeps the last real title when a later update carries no title", () => {
    expect(extractAgentSessionTitle([
      sessionInfoEntry({ title: "Real title" }),
      sessionInfoEntry({ updatedAt: "2026-08-05T12:00:00.000Z" }),
    ])).toBe("Real title");
  });

  it("ignores blank titles", () => {
    expect(extractAgentSessionTitle([sessionInfoEntry({ title: "   " })])).toBeNull();
  });

  it("returns null when the stream carries no session info", () => {
    expect(extractAgentSessionTitle([
      { id: randomUUID(), type: "message", text: "hello", raw: {} },
    ])).toBeNull();
    expect(extractAgentSessionTitle([])).toBeNull();
    expect(extractAgentSessionTitle(undefined)).toBeNull();
  });
});

describe("applyAgentSessionTitle", () => {
  beforeEach(async () => {
    await db.delete(runs);
    await db.delete(plans);
    __resetNamedEventsForTests();
  });

  async function insertRun(title: string) {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      projectPath: "/workspace/app",
      title,
      createdAt: now,
      updatedAt: now,
    });
    return runId;
  }

  async function readTitle(runId: string) {
    const row = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    return row?.title ?? null;
  }

  it("replaces the first-message fallback title with the agent's title", async () => {
    const runId = await insertRun("Sometimes I Send A Message And");

    await applyAgentSessionTitle({ runId, title: "Duplicate sent-message race condition" });

    expect(await readTitle(runId)).toBe("Duplicate sent-message race condition");
  });

  it("emits a named event recording the adoption", async () => {
    const runId = await insertRun("Old Title");

    await applyAgentSessionTitle({ runId, title: "Agent title" });

    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_updated",
        runId,
        source: "agent_session",
        title: "Agent title",
      }),
    );
  });

  it("does not write or emit when the title is unchanged", async () => {
    const runId = await insertRun("Already correct");
    __resetNamedEventsForTests();

    await applyAgentSessionTitle({ runId, title: "Already correct" });

    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).not.toContainEqual(
      expect.objectContaining({ kind: "conversation.title_updated" }),
    );
  });

  it("ignores a blank title rather than clearing the run's own", async () => {
    const runId = await insertRun("Keep me");

    await applyAgentSessionTitle({ runId, title: "   " });

    expect(await readTitle(runId)).toBe("Keep me");
  });

  it("rejects a title that leaks the direct-control prompt", async () => {
    const runId = await insertRun("Fix the caption editor mode switch");
    const leakedTitle = [
      "OmniHarness direct-control instruction:",
      "Treat a user's request for an outcome as authorization for the normal, safe, in-scope steps required to complete it.",
      "User message:",
      "Fix the caption editor mode switch",
    ].join(" ");

    await applyAgentSessionTitle({ runId, title: leakedTitle });

    expect(await readTitle(runId)).toBe("Fix the caption editor mode switch");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).not.toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_updated",
        runId,
      }),
    );
  });

  /**
   * The direct-control preamble was the only leak the guard knew about, so when
   * a session failed to resume the transcript-replay preamble sailed through
   * and the whole 4KB replay prompt — transcript and all — became the title.
   */
  it("rejects a title that leaks the transcript-replay prompt", async () => {
    const runId = await insertRun("Add a mobile sidebar close button");
    const leakedTitle = buildTranscriptReplayPrompt({
      runId: "run-1",
      workerId: "worker-1",
      nextUserPrompt: "Add a mobile sidebar close button",
    });
    // Codex reports the prompt with its newlines collapsed to spaces.
    const echoedTitle = (await leakedTitle).replace(/\s+/g, " ");

    await applyAgentSessionTitle({ runId, title: echoedTitle });

    expect(await readTitle(runId)).toBe("Add a mobile sidebar close button");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_rejected",
        runId,
        reason: "prompt_leak",
      }),
    );
  });

  /**
   * The preamble list only covers prompts this repo writes. Length is the
   * backstop for the ones it does not: a title is short, a prompt is not.
   */
  it("rejects a title long enough to be an echoed prompt", async () => {
    const runId = await insertRun("Keep the fallback");

    await applyAgentSessionTitle({ runId, title: "Fix the thing. ".repeat(20) });

    expect(await readTitle(runId)).toBe("Keep the fallback");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_rejected",
        runId,
        reason: "too_long",
      }),
    );
  });

  it("reports a rejected title as rejected and an unchanged one as unchanged", async () => {
    const runId = await insertRun("Already correct");

    expect(await applyAgentSessionTitle({ runId, title: "Already correct" })).toBe("unchanged");
    expect(await applyAgentSessionTitle({ runId, title: "x".repeat(200) })).toBe("rejected");
    expect(await applyAgentSessionTitle({ runId, title: "A better title" })).toBe("applied");
  });
});

/**
 * The write guard cannot undo the damage it was added to prevent. A run
 * poisoned before it existed keeps the 4KB prompt forever, because the agent
 * that wrote it goes on echoing prompts rather than summarising them, so no
 * clean title ever arrives to replace it.
 */
describe("repairLeakedConversationTitles", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(runs);
    await db.delete(plans);
    __resetNamedEventsForTests();
  });

  async function insertRun(title: string) {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "done",
      projectPath: "/workspace/app",
      title,
      createdAt: now,
      updatedAt: now,
    });
    return runId;
  }

  async function insertUserMessage(runId: string, content: string, extra: {
    kind?: string;
    supersededAt?: Date;
    createdAt?: Date;
  } = {}) {
    await db.insert(messages).values({
      id: randomUUID(),
      runId,
      role: "user",
      kind: extra.kind ?? null,
      content,
      supersededAt: extra.supersededAt ?? null,
      createdAt: extra.createdAt ?? new Date(),
    });
  }

  async function readTitle(runId: string) {
    const row = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    return row?.title ?? null;
  }

  it("puts back the first user message when the title is a leaked replay prompt", async () => {
    const runId = await insertRun("placeholder");
    await insertUserMessage(runId, "Add a mobile sidebar close button");
    const leaked = await buildTranscriptReplayPrompt({
      runId,
      workerId: "worker-1",
      nextUserPrompt: "Add a mobile sidebar close button",
    });
    await db.update(runs).set({ title: leaked }).where(eq(runs.id, runId));

    expect(await repairLeakedConversationTitles()).toBe(1);
    expect(await readTitle(runId)).toBe("Add a mobile sidebar close button");
  });

  it("repairs a title long enough to be an echoed prompt the markers miss", async () => {
    const runId = await insertRun("Fix the thing. ".repeat(20));
    await insertUserMessage(runId, "Fix the caption editor mode switch");

    expect(await repairLeakedConversationTitles()).toBe(1);
    expect(await readTitle(runId)).toBe("Fix the caption editor mode switch");
  });

  it("leaves a healthy title alone", async () => {
    const runId = await insertRun("Duplicate sent-message race condition");
    await insertUserMessage(runId, "something else entirely");

    expect(await repairLeakedConversationTitles()).toBe(0);
    expect(await readTitle(runId)).toBe("Duplicate sent-message race condition");
  });

  /**
   * The repair has to land on the message a human would recognise as the start
   * of the conversation — the same one `create` titles from — not on harness
   * bookkeeping or an edited-away draft.
   */
  it("skips internal and superseded messages when choosing the replacement", async () => {
    const runId = await insertRun("x".repeat(200));
    const base = new Date();
    await insertUserMessage(runId, "internal bookkeeping", {
      kind: "internal",
      createdAt: new Date(base.getTime() - 3000),
    });
    await insertUserMessage(runId, "a draft I edited away", {
      supersededAt: base,
      createdAt: new Date(base.getTime() - 2000),
    });
    await insertUserMessage(runId, "The real first message", {
      createdAt: new Date(base.getTime() - 1000),
    });

    await repairLeakedConversationTitles();

    expect(await readTitle(runId)).toBe("The real first message");
  });

  it("falls back to the placeholder when the run has no user message left", async () => {
    const runId = await insertRun("x".repeat(200));

    await repairLeakedConversationTitles();

    expect(await readTitle(runId)).toBe("New conversation");
  });

  it("records the repair as a title update", async () => {
    const runId = await insertRun("x".repeat(200));
    await insertUserMessage(runId, "Fix the sidebar");

    await repairLeakedConversationTitles();

    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "conversation.title_updated",
        runId,
        source: "leak_repair",
        title: "Fix the sidebar",
      }),
    );
  });
});

/**
 * The Codex ACP adapter publishes `createPromptFallbackTitle(prompt)` whenever
 * its thread has no name, so a prompt short enough to clear the length bound
 * and free of any preamble arrives looking exactly like a real title.
 */
describe("applyAgentSessionTitle prompt echoes", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
    __resetNamedEventsForTests();
  });

  async function seedRun(args: { title: string; userMessage?: string; initialPrompt?: string }) {
    const planId = randomUUID();
    const runId = randomUUID();
    const now = new Date();
    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
    if (args.userMessage) {
      await db.insert(messages).values({
        id: randomUUID(),
        runId,
        role: "user",
        kind: "checkpoint",
        content: args.userMessage,
        createdAt: now,
      });
    }
    if (args.initialPrompt) {
      await db.insert(workers).values({
        id: `${runId}-worker-1`,
        runId,
        type: "codex",
        status: "working",
        cwd: "/workspace",
        initialPrompt: args.initialPrompt,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        createdAt: now,
        updatedAt: now,
      });
    }
    return runId;
  }

  async function readTitle(runId: string) {
    const row = await db.select({ title: runs.title }).from(runs).where(eq(runs.id, runId)).get();
    return row?.title ?? null;
  }

  it("rejects a candidate that is the user's message handed back", async () => {
    const runId = await seedRun({ title: "Commit", userMessage: "Commit" });

    expect(await applyAgentSessionTitle({ runId, title: "Commit" })).toBe("rejected");
    expect(getNamedEventsSince(0).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({ kind: "conversation.title_rejected", runId, reason: "prompt_echo" }),
    );
  });

  it("rejects an echo that only differs by the whitespace the adapter collapsed", async () => {
    const runId = await seedRun({
      title: "Local to cloud",
      userMessage: "Local to\n  cloud",
    });

    expect(await applyAgentSessionTitle({ runId, title: "Local to cloud" })).toBe("rejected");
  });

  it("rejects an echo the adapter truncated", async () => {
    const prompt = "Investigate why the sidebar loses its scroll position on reload";
    const runId = await seedRun({ title: "Investigate why", userMessage: prompt });

    expect(await applyAgentSessionTitle({ runId, title: "Investigate why the sidebar…" })).toBe("rejected");
  });

  it("rejects an echo of the worker's launch prompt even when no message row survives", async () => {
    const runId = await seedRun({ title: "Fix the export", initialPrompt: "Fix the export" });

    expect(await applyAgentSessionTitle({ runId, title: "Fix the export" })).toBe("rejected");
  });

  it("keeps a real title that merely opens with the same words", async () => {
    // A good summary of a short request looks like its opening words. Only an
    // exact or truncated match counts as an echo.
    const runId = await seedRun({
      title: "Fix the login button on mobile, it does nothing when tapped",
      userMessage: "Fix the login button on mobile, it does nothing when tapped",
    });

    expect(await applyAgentSessionTitle({ runId, title: "Fix the login button" })).toBe("applied");
    expect(await readTitle(runId)).toBe("Fix the login button");
  });

  it("keeps a title the provider actually generated", async () => {
    const runId = await seedRun({
      title: "commit, push, pull, sync everything",
      userMessage: "commit, push, pull, sync everything",
    });

    expect(await applyAgentSessionTitle({ runId, title: "Sync and push everything" })).toBe("applied");
    expect(await readTitle(runId)).toBe("Sync and push everything");
  });
});
