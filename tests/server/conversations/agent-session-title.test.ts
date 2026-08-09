import { beforeEach, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";
import {
  applyAgentSessionTitle,
  extractAgentSessionTitle,
} from "@/server/conversations/agent-session-title";
import { __resetNamedEventsForTests, getNamedEventsSince } from "@/server/events/named-events";

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
      "Do not implement, edit files, run mutating commands, or otherwise change the workspace.",
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
});
