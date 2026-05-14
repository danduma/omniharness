import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/planning/[id]/review/route";
import * as reviewOrchestration from "@/server/planning/review";
import { NextRequest } from "next/server";

vi.mock("@/server/auth/guards", () => ({
  requireApiSession: vi.fn(() => Promise.resolve({ user: { id: "user-1" } })),
}));

vi.mock("@/server/planning/review", () => ({
  startPlanningReview: vi.fn(() => Promise.resolve({ reviewRunId: "review-1", status: "running" })),
}));

vi.mock("@/server/events/live-updates", () => ({
  notifyEventStreamSubscribers: vi.fn(),
}));

describe("planning review API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates and starts review", async () => {
    const req = new NextRequest("http://localhost/api/planning/run-1/review", {
      method: "POST",
      body: JSON.stringify({ agentSelection: "claude", rounds: 2 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: "run-1" }) });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.reviewRunId).toBe("review-1");
    expect(reviewOrchestration.startPlanningReview).toHaveBeenCalledWith({
      runId: "run-1",
      agentSelection: "claude",
      rounds: 2,
    });
  });

  it("returns 400 for unready plan", async () => {
    vi.mocked(reviewOrchestration.startPlanningReview).mockRejectedValueOnce(new Error("No ready plan artifacts found"));

    const req = new NextRequest("http://localhost/api/planning/run-1/review", {
      method: "POST",
    });

    const res = await POST(req, { params: Promise.resolve({ id: "run-1" }) });
    expect(res.status).toBe(400);
  });
});
