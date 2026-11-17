import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CodeReviewPanel } from "@/components/home/CodeReviewPanel";
import { RuntimeApiProvider } from "@/runtime-api/provider";
import type { RuntimeAPIs } from "@/runtime-api/types";
import type { CodeReviewRecord } from "@/shared/code-review";

function review(overrides: Partial<CodeReviewRecord>): CodeReviewRecord {
  return {
    id: "r1",
    runId: "run-1",
    implementerWorkerId: "w1",
    implementerType: "codex",
    reviewerType: "claude",
    status: "running",
    maxRounds: 3,
    roundsCompleted: 0,
    outcomeReason: null,
    lastError: null,
    startedAt: "2026-10-08T00:00:00.000Z",
    completedAt: null,
    rounds: [],
    findings: [],
    ...overrides,
  };
}

function render(reviews: CodeReviewRecord[] | undefined) {
  const queryClient = new QueryClient();
  if (reviews) queryClient.setQueryData(["codeReviews", "run-1", 0], reviews);
  const apis = { codeReviews: { list: async () => ({ reviews: [] }), start: async () => ({ ok: true }) } } as unknown as RuntimeAPIs;
  return renderToStaticMarkup(
    <QueryClientProvider client={queryClient}>
      <RuntimeApiProvider apis={apis}>
        <CodeReviewPanel runId="run-1" />
      </RuntimeApiProvider>
    </QueryClientProvider>,
  );
}

describe("CodeReviewPanel", () => {
  it("explains the feature and offers to start when there is no review", () => {
    const html = render([]);
    expect(html).toContain("Cross-review");
    expect(html).toContain("Ask a different agent type to review this conversation&#x27;s changes.");
    expect(html).toContain("Start cross-review");
  });

  it("shows progress and disables starting while a review runs", () => {
    const html = render([review({ roundsCompleted: 1 })]);
    expect(html).toContain("Claude Code is reviewing Codex&#x27;s changes · round 2 of 3");
    expect(html).toMatch(/<details[^>]*open=""/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Start cross-review<\/button>/);
  });

  it("opens with an escalation and shows findings with location, status and dispute", () => {
    const html = render([review({
      status: "escalated",
      outcomeReason: "disagreement",
      roundsCompleted: 2,
      findings: [
        { id: "f1", roundNumber: 1, severity: "major", file: "src/cache.ts", line: 12, claim: "Clears every entry", evidence: null, suggestedFix: null, status: "escalated", disputeReason: "That is the spec" },
        { id: "f2", roundNumber: 1, severity: "nit", file: null, line: null, claim: "Old note", evidence: null, suggestedFix: null, status: "withdrawn", disputeReason: null },
      ],
    })]);
    expect(html).toMatch(/<details[^>]*open=""/);
    expect(html).toContain("Needs your decision");
    expect(html).toContain("The implementer disputes findings the reviewer kept open. Decide which is right.");
    expect(html).toContain("Findings (1)");
    expect(html).toContain("src/cache.ts:12");
    expect(html).toContain("Major");
    expect(html).toContain("Needs you");
    expect(html).toContain("Disputed: That is the spec");
    expect(html).not.toContain("Old note");
  });
});
