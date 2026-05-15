import { randomUUID } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const { mockAssess } = vi.hoisted(() => ({
  mockAssess: vi.fn(),
}));

vi.mock("@/server/plans/readiness-llm", async () => {
  const actual = await vi.importActual<typeof import("@/server/plans/readiness-llm")>(
    "@/server/plans/readiness-llm",
  );
  return {
    ...actual,
    assessPlanReadinessWithLLM: mockAssess,
  };
});

import { db } from "@/server/db";
import { plans, runs } from "@/server/db/schema";
import {
  ensureReadinessVerdict,
  hashPlanMarkdown,
  loadCachedReadinessRecord,
} from "@/server/plans/readiness-pipeline";

const PLAN_MD = [
  "## Phase 1",
  "- [ ] Build it",
  "  - Verify: it builds",
].join("\n");

async function seedRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({
    id: planId,
    path: "plan.md",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: runId,
    planId,
    mode: "planning",
    projectPath: "/tmp",
    status: "working",
    createdAt: now,
    updatedAt: now,
  });
  return runId;
}

describe("ensureReadinessVerdict", () => {
  beforeEach(async () => {
    mockAssess.mockReset();
    await db.delete(runs);
    await db.delete(plans);
  });

  it("caches a finalized verdict by plan hash", async () => {
    const runId = await seedRun();
    mockAssess.mockResolvedValue({
      ok: true,
      verdict: {
        verdict: "ready",
        confidence: 0.9,
        headline: "Plan is ready.",
        topConcern: null,
        concerns: [],
        rationale: "",
      },
    });

    const args = { runId, planPath: "/tmp/plan.md", planMarkdown: PLAN_MD, specPath: null, specMarkdown: null };

    const first = await ensureReadinessVerdict(args);
    // Allow the in-flight promise to settle and write the final record.
    await new Promise((r) => setTimeout(r, 10));

    const second = await ensureReadinessVerdict(args);

    expect(mockAssess).toHaveBeenCalledTimes(1);
    expect(first.status).toBe("analyzing");
    expect(second.status).toBe("ready");
    expect(second.verdict?.verdict).toBe("ready");
  });

  it("persists a fallback record when the LLM errors", async () => {
    const runId = await seedRun();
    mockAssess.mockResolvedValue({ ok: false, error: "boom" });

    await ensureReadinessVerdict({
      runId,
      planPath: "/tmp/plan.md",
      planMarkdown: PLAN_MD,
      specPath: null,
      specMarkdown: null,
    });
    await new Promise((r) => setTimeout(r, 10));

    const cached = await loadCachedReadinessRecord({
      runId,
      planPath: "/tmp/plan.md",
      planHash: hashPlanMarkdown(PLAN_MD),
    });
    expect(cached?.status).toBe("fallback");
    expect(cached?.error).toBe("boom");
    expect(cached?.fallbackHeadline).toBeTruthy();
  });

  it("dedupes concurrent in-flight calls", async () => {
    const runId = await seedRun();
    const resolvers: Array<(value: unknown) => void> = [];
    mockAssess.mockImplementation(() => new Promise((resolve) => {
      resolvers.push(resolve);
    }));

    const args = { runId, planPath: "/tmp/plan.md", planMarkdown: PLAN_MD, specPath: null, specMarkdown: null };
    await Promise.all([
      ensureReadinessVerdict(args),
      ensureReadinessVerdict(args),
      ensureReadinessVerdict(args),
    ]);

    expect(mockAssess).toHaveBeenCalledTimes(1);
    resolvers[0]?.({
      ok: true,
      verdict: {
        verdict: "ready",
        confidence: 1,
        headline: "Plan is ready.",
        topConcern: null,
        concerns: [],
        rationale: "",
      },
    });
    await new Promise((r) => setTimeout(r, 10));
  });

  it("patches plannerArtifactsJson when the verdict finalizes", async () => {
    const runId = await seedRun();
    const planPath = "/tmp/plan.md";
    await db
      .update(runs)
      .set({
        plannerArtifactsJson: JSON.stringify({
          specPath: null,
          planPath,
          candidates: [{ path: planPath, kind: "plan", exists: true }],
        }),
        updatedAt: new Date(),
      })
      .where(eq(runs.id, runId));

    mockAssess.mockResolvedValue({
      ok: true,
      verdict: {
        verdict: "needs_review",
        confidence: 0.7,
        headline: "Plan has gaps.",
        topConcern: "missing verify",
        concerns: [{ kind: "missing_verify", itemIndex: 0, detail: "Add a Verify line." }],
        rationale: "",
      },
    });

    await ensureReadinessVerdict({
      runId,
      planPath,
      planMarkdown: PLAN_MD,
      specPath: null,
      specMarkdown: null,
    });
    await new Promise((r) => setTimeout(r, 10));

    const refreshed = await db.select().from(runs).where(eq(runs.id, runId)).get();
    const artifacts = JSON.parse(refreshed!.plannerArtifactsJson!);
    expect(artifacts.candidates[0].readinessRecord?.verdict?.verdict).toBe("needs_review");
    expect(artifacts.candidates[0].readinessRecord?.verdict?.headline).toBe("Plan has gaps.");
  });
});
