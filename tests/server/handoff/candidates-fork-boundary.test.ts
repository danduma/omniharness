import { describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";
import { gatherHandoffCandidates } from "@/server/handoff/candidates";
import { appendWorkerEntryWithResult } from "@/server/workers/output-store";

async function seedConversation() {
  const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-fork-boundary-"));
  const planId = randomUUID();
  const runId = randomUUID();
  const workerId = `worker-${randomUUID()}`;
  const firstMessageId = randomUUID();
  const secondMessageId = randomUUID();
  const firstReplyId = `reply-${randomUUID()}`;
  await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/none.md", status: "running", createdAt: new Date(), updatedAt: new Date() });
  await db.insert(runs).values({ id: runId, planId, mode: "direct", title: "Source", projectPath, status: "running", createdAt: new Date(), updatedAt: new Date() });
  await db.insert(workers).values({ id: workerId, runId, type: "codex", status: "idle", cwd: projectPath, outputLog: "", outputEntriesJson: "[]", currentText: "", lastText: "", createdAt: new Date(), updatedAt: new Date() });
  await db.insert(messages).values([
    { id: firstMessageId, runId, role: "user", kind: "checkpoint", content: "first prompt", createdAt: new Date("2026-04-21T10:00:00Z") },
    { id: secondMessageId, runId, role: "user", kind: "checkpoint", content: "second prompt", createdAt: new Date("2026-04-21T10:02:00Z") },
  ]);
  for (const entry of [
    { id: firstMessageId, type: "user_input", text: "first prompt", timestamp: "2026-04-21T10:00:01.000Z", authorRole: "user", channel: "stdin" },
    { id: firstReplyId, type: "message", text: "first answer", timestamp: "2026-04-21T10:00:30.000Z" },
    { id: secondMessageId, type: "user_input", text: "second prompt", timestamp: "2026-04-21T10:02:01.000Z", authorRole: "user", channel: "stdin" },
    { id: `reply-${randomUUID()}`, type: "message", text: "second answer", timestamp: "2026-04-21T10:02:30.000Z" },
  ] as const) {
    await appendWorkerEntryWithResult(runId, workerId, entry);
  }
  return { runId, workerId, firstReplyId, secondMessageId };
}

describe("gatherHandoffCandidates fork boundary", () => {
  it("keeps an assistant reply boundary and everything before it", async () => {
    const { runId, workerId, firstReplyId } = await seedConversation();

    const gathered = await gatherHandoffCandidates({ runId, workerId, forkedFromMessageId: firstReplyId });

    expect(gathered.recentUserMessages).toEqual(["first prompt"]);
    expect(gathered.currentObjective).toBe("first prompt");
    expect(gathered.recentAssistantSummary).toContain("first answer");
    expect(gathered.recentAssistantSummary ?? "").not.toContain("second answer");
  });

  it("still stops before the reply to a user checkpoint boundary", async () => {
    const { runId, workerId, secondMessageId } = await seedConversation();

    const gathered = await gatherHandoffCandidates({ runId, workerId, forkedFromMessageId: secondMessageId });

    expect(gathered.recentUserMessages).toEqual(["first prompt", "second prompt"]);
    expect(gathered.recentAssistantSummary ?? "").not.toContain("second answer");
  });

  it("rejects a boundary that is not in the conversation", async () => {
    const { runId, workerId } = await seedConversation();

    await expect(gatherHandoffCandidates({ runId, workerId, forkedFromMessageId: "reply-missing" }))
      .rejects.toThrow("does not belong to the source conversation");
  });
});
