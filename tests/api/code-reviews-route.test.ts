import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { codeReviewFindings, codeReviews, plans, runs } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";

vi.mock("@/server/bridge-client", () => ({
  askAgent: vi.fn(),
  getAgent: vi.fn(),
  spawnAgent: vi.fn(),
  cancelAgent: vi.fn(),
  BRIDGE_URL: "http://localhost:0",
}));

import { codeReviewsRoute } from "@/../tests/helpers/runtime-routes";

async function request(url: string, init: RequestInit = {}) {
  const session = await createAuthSession({ label: "Code review test", userAgent: "Vitest", authMethod: "password_login" });
  const headers = new Headers(init.headers);
  headers.set("cookie", `omni_session=${session.tokenValue}`);
  if (init.method && init.method !== "GET") headers.set("origin", "http://localhost");
  return new Request(url, { ...init, headers });
}

async function seedRun() {
  const planId = randomUUID();
  const runId = randomUUID();
  const now = new Date();
  await db.insert(plans).values({ id: planId, path: "vibes/ad-hoc/plan.md", status: "running", createdAt: now, updatedAt: now });
  await db.insert(runs).values({ id: runId, planId, mode: "direct", status: "running", createdAt: now, updatedAt: now });
  return runId;
}

describe("/api/runs/:id/code-reviews", () => {
  beforeEach(() => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "swordfish";
    delete process.env.OMNIHARNESS_AUTH_PASSWORD_HASH;
  });
  afterEach(() => {
    delete process.env.OMNIHARNESS_AUTH_PASSWORD;
  });

  it("lists reviews with rounds and findings, newest first", async () => {
    const runId = await seedRun();
    const reviewId = randomUUID();
    const now = new Date();
    await db.insert(codeReviews).values({
      id: reviewId, runId, implementerWorkerId: "w1", implementerType: "codex", reviewerType: "claude",
      status: "escalated", maxRounds: 3, roundsCompleted: 2, outcomeReason: "disagreement", startedAt: now, createdAt: now, updatedAt: now,
    });
    await db.insert(codeReviewFindings).values({
      id: randomUUID(), reviewId, runId, roundNumber: 1, severity: "major", file: "a.ts", line: 3, claim: "Wrong",
      status: "escalated", disputeReason: "Intended", createdAt: now, updatedAt: now,
    });

    const response = await codeReviewsRoute(await request(`http://localhost/api/runs/${runId}/code-reviews`), { params: { id: runId } });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.reviews).toEqual([expect.objectContaining({
      id: reviewId,
      status: "escalated",
      outcomeReason: "disagreement",
      rounds: [],
      findings: [expect.objectContaining({ severity: "major", file: "a.ts", line: 3, status: "escalated", disputeReason: "Intended" })],
    })]);
  });

  it("returns a refusal as a typed result, not an error", async () => {
    const runId = await seedRun();
    const response = await codeReviewsRoute(await request(`http://localhost/api/runs/${runId}/code-reviews`, {
      method: "POST",
      body: JSON.stringify({}),
    }), { params: { id: runId } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, refused: "no_implementer" });
  });

  it("requires a session", async () => {
    const runId = await seedRun();
    const bypass = process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    delete process.env.OMNIHARNESS_TEST_BYPASS_AUTH;
    try {
      const response = await codeReviewsRoute(new Request(`http://localhost/api/runs/${runId}/code-reviews`), { params: { id: runId } });
      expect(response.status).toBe(401);
    } finally {
      if (bypass !== undefined) process.env.OMNIHARNESS_TEST_BYPASS_AUTH = bypass;
    }
  });
});
