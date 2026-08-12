import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GoalPlanCard } from "@/components/home/GoalPlanCard";
import type { GoalSnapshot } from "@/shared/goal-plan";

vi.mock("@/runtime-api/provider", () => ({
  useRuntimeAPIs: () => ({
    goals: {
      put: vi.fn(),
      act: vi.fn(),
    },
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render, children }: { render: React.ReactElement; children: React.ReactNode }) => (
    React.cloneElement(render, {}, children)
  ),
}));

const goal: GoalSnapshot = {
  schemaVersion: 1,
  runId: "run-1",
  goalId: "goal-1",
  revision: 3,
  leaseGeneration: 1,
  objective: "Ship a durable goal card",
  status: "pursuing",
  startedAt: "2026-08-10T10:00:00.000Z",
  pausedAt: null,
  resumedAt: null,
  completedAt: null,
  clearedAt: null,
  updatedAt: "2026-08-10T10:00:05.000Z",
  workerId: "worker-1",
  acpSessionId: "session-1",
  plan: [
    { id: "one", title: "Inspect", phase: "Build", status: "completed", order: 0, providerId: null },
    { id: "two", title: "Implement", phase: "Build", status: "in_progress", order: 1, providerId: null },
  ],
  planSource: { kind: "items" },
  capabilities: { set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: null },
  lastError: null,
  validationState: null,
  visible: true,
  provenance: { source: "server", complete: true, eventCursor: null },
};

describe("GoalPlanCard", () => {
  it("renders the real canonical objective and non-submit accessible controls", () => {
    const html = renderToStaticMarkup(<GoalPlanCard goal={goal} onSnapshot={vi.fn()} />);
    expect(html).toContain("Ship a durable goal card");
    expect(html).toContain("Pursuing");
    expect(html).toContain('aria-label="Edit goal"');
    expect(html).toContain('title="Edit goal"');
    expect(html).toContain('aria-label="Pause goal"');
    expect(html).toContain('aria-label="Clear goal"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('type="submit"');
  });

  it("keeps mobile actions discoverable through the responsive overflow", () => {
    const html = renderToStaticMarkup(<GoalPlanCard goal={goal} onSnapshot={vi.fn()} />);
    expect(html).toContain("sm:hidden");
    expect(html).toContain("More goal actions");
    expect(html).toContain("sm:flex");
  });

  it("does not render cleared or hidden tombstones", () => {
    expect(renderToStaticMarkup(<GoalPlanCard goal={{ ...goal, visible: false, status: "cleared" }} onSnapshot={vi.fn()} />)).toBe("");
  });

  it("does not present pause or resume outside a legal status", () => {
    const html = renderToStaticMarkup(<GoalPlanCard goal={{ ...goal, status: "blocked" }} onSnapshot={vi.fn()} />);
    expect(html).not.toContain('aria-label="Pause goal"');
    expect(html).not.toContain('aria-label="Resume goal"');
  });

  it("renders a surfaced provider error without relying on status color", () => {
    const html = renderToStaticMarkup(<GoalPlanCard goal={{ ...goal, status: "error", lastError: "Connection interrupted." }} onSnapshot={vi.fn()} />);
    expect(html).toContain("Connection interrupted.");
    expect(html).toContain('role="alert"');
  });
});
