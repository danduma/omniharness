import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationTimeline, timelineCategory } from "@/components/home/OrchestrationTimeline";
import { OrchestrationManager, type OrchestrationState } from "@/interface/orchestration/OrchestrationManager";
import { i18nManager } from "@/lib/i18n";
import { RuntimeApiProvider } from "@/runtime-api/provider";
import type { RuntimeAPIs } from "@/runtime-api/types";
import type { WorkflowSnapshotDto, WorkflowStageDto } from "@/shared/orchestration-api";
import { createDefaultOrchestrationPolicy } from "@/shared/orchestration-policy";

function stage(overrides: Partial<WorkflowStageDto>): WorkflowStageDto {
  return {
    id: `s-${overrides.seq ?? 1}`,
    stage: "plan",
    attempt: 1,
    seq: 1,
    status: "completed",
    outcome: "passed",
    requestedWorkerType: "claude",
    requestedModel: "claude-opus-5-5",
    effectiveModel: null,
    usedFallback: false,
    workerId: null,
    executionRunId: null,
    handoffId: null,
    failureCode: null,
    lastError: null,
    reservedTokens: 600_000,
    reservedCostUsd: 15,
    settled: true,
    usageUnknown: false,
    settledTokens: 1_500,
    settledCostUsd: 0.25,
    createdAt: "2026-11-04T00:00:00.000Z",
    completedAt: "2026-11-04T00:01:00.000Z",
    ...overrides,
  };
}

function snapshot(overrides: Partial<WorkflowSnapshotDto> = {}): WorkflowSnapshotDto {
  return {
    runId: "run-1",
    profile: "balanced",
    profileSource: "default",
    locked: true,
    cancelled: false,
    policyVersion: 1,
    profilePolicy: createDefaultOrchestrationPolicy().profiles.balanced,
    stages: [],
    budget: { reservedTokens: 0, reservedCostUsd: 0, settledTokens: 0, settledCostUsd: 0, committedTokens: 601_500, committedCostUsd: 15.25, unsettledStages: 1, unknownUsageStages: 1 },
    next: { kind: "active", stage: "plan_review", attempt: 1 },
    triage: null,
    ...overrides,
  };
}

const apis = { orchestration: { getWorkflow: async () => ({ workflow: null }), act: async () => ({ ok: true }), preflight: async () => ({ ok: true }) } } as unknown as RuntimeAPIs;

let initial: Partial<OrchestrationState> = {};

/** SSR renders a manager's initial state, so each render gets a manager seeded with it. */
function render() {
  return renderToStaticMarkup(
    <RuntimeApiProvider apis={apis}>
      <OrchestrationTimeline runId="run-1" manager={new OrchestrationManager(initial)} />
    </RuntimeApiProvider>,
  );
}

function seed(workflow: WorkflowSnapshotDto | null, extra: Record<string, unknown> = {}) {
  initial = {
    ...initial,
    workflowByRunId: { "run-1": { status: "ready", snapshot: workflow, pendingAction: null, lastRefusal: null, lastError: false, ...extra } },
  };
}

beforeEach(() => {
  initial = {};
});

afterEach(async () => {
  await i18nManager.setLocaleAsync("en");
});

describe("OrchestrationTimeline", () => {
  it("distinguishes pending, blocked, active, complete, and recovery states", () => {
    expect(timelineCategory("pending")).toBe("pending");
    expect(timelineCategory("waiting")).toBe("active");
    expect(timelineCategory("dispatched")).toBe("active");
    expect(timelineCategory("completed")).toBe("complete");
    expect(timelineCategory("failed")).toBe("blocked");
    expect(timelineCategory("blocked")).toBe("blocked");
    expect(timelineCategory("needs_recovery")).toBe("recovery");
  });

  it("renders stages in seq order with bindings, caps, and unknown usage", () => {
    seed(snapshot({
      stages: [
        stage({ id: "b", seq: 3, stage: "plan_review", status: "waiting", outcome: null, requestedWorkerType: "codex", requestedModel: "gpt-5.6-terra", settled: false, settledTokens: null, reservedTokens: 300_000 }),
        stage({ id: "a", seq: 1, stage: "triage", requestedWorkerType: null, requestedModel: "typesafe-ai/jev", outcome: "advisory", reservedTokens: null, settled: false }),
        stage({ id: "c", seq: 2, stage: "plan", usageUnknown: true, settledTokens: null }),
      ],
    }));
    const html = render();
    const order = ["Triage", "Plan", "Plan review"].map((label) => html.indexOf(`>${label}<`));
    expect(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1]!))).toBe(true);
    expect(html).toContain("Codex · gpt-5.6-terra");
    expect(html).toContain("Usage not reported");
    expect(html).toContain("1 stage(s) with unreported usage");
    expect(html).toContain("Profile locked");
    expect(html).toContain("Plan review is in progress.");
  });

  it("offers retry for a recoverable stage and shows its failure", () => {
    seed(snapshot({
      stages: [stage({ stage: "plan", status: "needs_recovery", outcome: null, failureCode: "interrupted_by_restart", settled: false })],
      next: { kind: "blocked", stage: "plan", attempt: 1, reason: "needs_recovery" },
    }));
    const html = render();
    expect(html).toContain('data-category="recovery"');
    expect(html).toContain("Interrupted by a server restart.");
    expect(html).toContain("Retry stage");
    expect(html).toContain("Cancel workflow");
  });

  it("does not offer retry when a review loop reached its cap", () => {
    seed(snapshot({ next: { kind: "blocked", stage: "code_review", attempt: 2, reason: "repair_cap_reached" } }));
    const html = render();
    expect(html).not.toContain("Retry stage");
    expect(html).toContain("Your decision is needed.");
  });

  it("disables start until the chosen profile's preflight is ready", () => {
    seed(null);
    expect(render()).toMatch(/<button[^>]*disabled=""[^>]*>Start workflow<\/button>/);
    initial = { ...initial, preflightByProfile: { balanced: { status: "ready", report: { runId: "", profile: "balanced", ready: true, stages: [] } } } };
    expect(render()).not.toMatch(/<button[^>]*disabled=""[^>]*>Start workflow<\/button>/);
  });

  it("shows a translated refusal", () => {
    seed(snapshot(), { lastRefusal: "profile_locked" });
    expect(render()).toContain("The profile can no longer change: the workflow has started.");
  });

  it("re-renders in the selected language", async () => {
    seed(snapshot({ next: { kind: "done" } }));
    await i18nManager.setLocaleAsync("es");
    const html = render();
    expect(html).toContain("Flujo de especialistas");
    expect(html).toContain("Todas las etapas están hechas.");
  });
});
