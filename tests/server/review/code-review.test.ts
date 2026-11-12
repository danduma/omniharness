import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { codeReviewFindings, codeReviewRounds, codeReviews, plans, runs, workers } from "@/server/db/schema";
import { __resetNamedEventsForTests, getNamedEventsSince, type NamedEvent } from "@/server/events/named-events";

const { mockAskAgent, mockGetAgent, mockSpawnAgent, mockCancelAgent } = vi.hoisted(() => ({
  mockAskAgent: vi.fn(),
  mockGetAgent: vi.fn(),
  mockSpawnAgent: vi.fn(),
  mockCancelAgent: vi.fn(),
}));

vi.mock("@/server/bridge-client", () => ({
  askAgent: mockAskAgent,
  getAgent: mockGetAgent,
  spawnAgent: mockSpawnAgent,
  cancelAgent: mockCancelAgent,
  BRIDGE_URL: "http://localhost:0",
}));

// Reviewer selection checks installed CLIs and quota; that is environment.
vi.mock("@/server/supervisor/worker-availability", async () => ({
  ...(await vi.importActual<typeof import("@/server/supervisor/worker-availability")>("@/server/supervisor/worker-availability")),
  isSpawnableWorkerType: () => ({ ok: true }),
}));
vi.mock("@/server/quota/type-blocking", async () => ({
  ...(await vi.importActual<typeof import("@/server/quota/type-blocking")>("@/server/quota/type-blocking")),
  isWorkerTypeQuotaBlocked: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/server/workers/snapshots", () => ({ persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined) }));

import { startCodeReview } from "@/server/review/code-review";
import { listCodeReviewsForRun } from "@/server/review/store";
import { deleteConversationForApi } from "@/runtime/http/routes/runs";

const dirs: string[] = [];

function verdict(body: Record<string, unknown>) {
  return { response: `Reviewed.\n\`\`\`json\n${JSON.stringify(body)}\n\`\`\``, state: "idle" };
}

async function seed(options: { allowed?: string[]; change?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-code-review-"));
  dirs.push(dir);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  git("init", "-q");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  fs.writeFileSync(path.join(dir, "cache.ts"), "export const cache = new Map();\n");
  git("add", ".");
  git("commit", "-q", "-m", "base");
  const base = git("rev-parse", "HEAD");
  if (options.change !== false) {
    fs.writeFileSync(path.join(dir, "cache.ts"), "export const cache = new Map();\nexport function evict() { cache.clear(); }\n");
  }

  const planId = randomUUID();
  const runId = randomUUID();
  const implementerId = `${runId}-worker-1`;
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/plan.md", status: "running", createdAt: now, updatedAt: now });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "direct",
    title: "Add cache eviction",
    status: "running",
    projectPath: dir,
    allowedWorkerTypes: JSON.stringify(options.allowed ?? ["codex", "claude"]),
    gitBaselineJson: JSON.stringify({ status: "ok", repoRoot: dir, headSha: base, clean: true, porcelain: "" }),
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(workers).values({
    id: implementerId,
    runId,
    type: "codex",
    status: "idle",
    cwd: dir,
    workerNumber: 1,
    lastText: "Added evict().",
    createdAt: now,
    updatedAt: now,
  });
  return { runId, implementerId, dir };
}

async function waitForFinish(reviewId: string) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const row = await db.select().from(codeReviews).where(eq(codeReviews.id, reviewId)).get();
    if (row && row.status !== "running") return row;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("review did not finish");
}

function events() {
  return getNamedEventsSince(0).events.map((entry) => entry.event as NamedEvent);
}

beforeEach(() => {
  __resetNamedEventsForTests();
  mockAskAgent.mockReset();
  mockGetAgent.mockReset().mockResolvedValue({ state: "idle", outputEntries: [] });
  mockSpawnAgent.mockReset().mockImplementation(async (params: { name: string; type: string }) => ({ name: params.name, type: params.type, state: "working" }));
  mockCancelAgent.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("code cross-review", () => {
  it("approves with evidence in one round using a different agent type", async () => {
    const { runId, implementerId } = await seed();
    mockAskAgent.mockResolvedValueOnce(verdict({ verdict: "approve", filesInspected: ["cache.ts"], testsRun: [] }));

    const started = await startCodeReview({ runId });
    expect(started).toMatchObject({ status: "running", reviewerType: "claude", implementerWorkerId: implementerId });
    const finished = await waitForFinish(started.reviewId);
    expect(finished).toMatchObject({ status: "approved", outcomeReason: "approved", roundsCompleted: 1 });

    // The reviewer is a read-only helper agent of the other type, not a
    // worker of the (direct, single-CLI) conversation, and it is torn down.
    expect(mockSpawnAgent).toHaveBeenCalledWith(expect.objectContaining({ type: "claude", mode: "read-only" }));
    const reviewerId = mockSpawnAgent.mock.calls[0]![0].name as string;
    expect(reviewerId).toBe(`code-review-${started.reviewId}-r1`);
    expect(mockCancelAgent).toHaveBeenCalledWith(reviewerId);
    expect(await db.select().from(workers).where(eq(workers.runId, runId))).toHaveLength(1);
    const [round] = await db.select().from(codeReviewRounds).where(eq(codeReviewRounds.reviewId, started.reviewId));
    expect(round).toMatchObject({ reviewerWorkerId: reviewerId, verdict: "approve" });
    expect(round?.responseExcerpt).toContain("Reviewed.");
    // The diff reached the reviewer.
    expect(mockAskAgent.mock.calls[0]![1]).toContain("+export function evict()");

    const kinds = events().map((event) => event.kind);
    expect(kinds).toEqual(expect.arrayContaining(["code_review.started", "worker.review_started", "worker.review_finished", "code_review.round_finished", "code_review.finished"]));
    expect(events()).toContainEqual(expect.objectContaining({ kind: "worker.review_started", reviewKind: "code", reviewerWorkerId: reviewerId, subjectWorkerId: implementerId }));
  });

  it("does not accept an approval that never shows evidence", async () => {
    const { runId } = await seed();
    mockAskAgent
      .mockResolvedValueOnce(verdict({ verdict: "approve" }))
      .mockResolvedValueOnce(verdict({ verdict: "approve" }));
    const started = await startCodeReview({ runId });
    const finished = await waitForFinish(started.reviewId);
    expect(finished).toMatchObject({ status: "escalated", outcomeReason: "no_evidence" });
    expect(mockAskAgent.mock.calls[1]![1]).toContain("did not show what you checked");
    const [round] = await db.select().from(codeReviewRounds).where(eq(codeReviewRounds.reviewId, started.reviewId));
    expect(round?.verdict).toBe("inconclusive");
  });

  it("hands findings to the implementer and escalates a dispute the reviewer keeps open", async () => {
    const { runId, implementerId } = await seed();
    const finding = { severity: "major", file: "cache.ts", line: 2, claim: "evict() clears every entry, not just stale ones", evidence: "line 2", suggestedFix: "Track age" };
    mockAskAgent.mockImplementation(async (name: string, prompt: string) => {
      if (name === implementerId) {
        const id = /id ([0-9a-f-]{36})/.exec(prompt)![1];
        return { response: `I disagree.\n\`\`\`json\n${JSON.stringify({ disputes: [{ id, reason: "Clearing everything is the spec" }] })}\n\`\`\``, state: "idle" };
      }
      if (prompt.includes("Review round 1")) {
        return verdict({ verdict: "request_changes", findings: [finding], filesInspected: ["cache.ts"] });
      }
      const id = /id ([0-9a-f-]{36})/.exec(prompt)![1];
      expect(prompt).toContain("Implementer disputes this: Clearing everything is the spec");
      return verdict({ verdict: "request_changes", previousFindings: [{ id, status: "open", note: "spec says stale only" }], filesInspected: ["cache.ts"] });
    });

    const started = await startCodeReview({ runId });
    const finished = await waitForFinish(started.reviewId);
    expect(finished).toMatchObject({ status: "escalated", outcomeReason: "disagreement", roundsCompleted: 2 });

    const [stored] = await db.select().from(codeReviewFindings).where(eq(codeReviewFindings.reviewId, started.reviewId));
    expect(stored).toMatchObject({ status: "escalated", disputeReason: "Clearing everything is the spec", file: "cache.ts", line: 2, severity: "major" });
    expect(events()).toContainEqual(expect.objectContaining({ kind: "code_review.findings_disputed", count: 1 }));
    expect(events()).toContainEqual(expect.objectContaining({ kind: "error.surfaced", code: "review.code.needs_user", runId }));

    const [listed] = await listCodeReviewsForRun(runId);
    expect(listed).toMatchObject({ status: "escalated", rounds: [{ roundNumber: 1, verdict: "request_changes" }, { roundNumber: 2, verdict: "request_changes" }] });
  });

  it("stops at the round limit without asking the implementer again", async () => {
    const { runId, implementerId } = await seed();
    mockAskAgent.mockResolvedValue(verdict({ verdict: "blocked", findings: [{ severity: "blocker", claim: "Breaks the build", file: "cache.ts", line: 1 }], testsRun: ["pnpm test"] }));
    const started = await startCodeReview({ runId, maxRounds: 1 });
    const finished = await waitForFinish(started.reviewId);
    expect(finished).toMatchObject({ status: "cap_reached", outcomeReason: "round_limit" });
    expect(mockAskAgent.mock.calls.some(([name]) => name === implementerId)).toBe(false);
  });

  it.each<[string, { allowed?: string[]; change?: boolean }]>([
    ["no_changes", { change: false }],
    ["no_independent_reviewer", { allowed: ["codex"] }],
  ])("refuses with %s", async (reason, options) => {
    const { runId } = await seed(options);
    await expect(startCodeReview({ runId })).rejects.toMatchObject({ reason });
    expect(events()).toContainEqual({ kind: "code_review.refused", runId, reason });
    expect(await db.select().from(codeReviews).where(eq(codeReviews.runId, runId))).toEqual([]);
  });

  it("refuses while the implementer is busy or already under review", async () => {
    const { runId } = await seed();
    mockGetAgent.mockResolvedValueOnce({ state: "working" });
    await expect(startCodeReview({ runId })).rejects.toMatchObject({ reason: "implementer_busy" });

    mockAskAgent.mockImplementation(() => new Promise(() => undefined));
    await startCodeReview({ runId });
    await expect(startCodeReview({ runId })).rejects.toMatchObject({ reason: "already_running" });
  });

  it("deletes code review rows with the conversation", async () => {
    const { runId } = await seed();
    mockAskAgent.mockResolvedValueOnce(verdict({ verdict: "request_changes", findings: [{ severity: "minor", claim: "naming" }], filesInspected: ["cache.ts"] }))
      .mockResolvedValueOnce({ response: "ok", state: "idle" })
      .mockResolvedValue(verdict({ verdict: "approve", filesInspected: ["cache.ts"] }));
    const started = await startCodeReview({ runId });
    await waitForFinish(started.reviewId);

    const deleted = await deleteConversationForApi(runId);
    expect(deleted.ok).toBe(true);
    expect(await db.select().from(codeReviews).where(eq(codeReviews.runId, runId))).toEqual([]);
    expect(await db.select().from(codeReviewFindings).where(eq(codeReviewFindings.runId, runId))).toEqual([]);
  });
});
