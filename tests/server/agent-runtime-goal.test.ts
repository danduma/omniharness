import { describe, expect, it } from "vitest";
import {
  MAX_ACP_GOAL_NESTING_DEPTH,
  normalizeAcpGoalMetadata,
  normalizeAcpGoalPlanUpdate,
} from "@/server/agent-runtime/acp/goal-state";

describe("ACP goal normalization", () => {
  it("normalizes versioned goal metadata and explicit capabilities", () => {
    expect(normalizeAcpGoalMetadata({
      _meta: {
        goal: {
          version: 1,
          goalId: "provider-goal",
          objective: "Ship durable goals",
          status: "in_progress",
          capabilities: { set: true, edit: true, pause: true, resume: true, clear: true },
        },
      },
    })).toEqual({
      ok: true,
      value: {
        schemaVersion: 1,
        providerGoalId: "provider-goal",
        objective: "Ship durable goals",
        status: "pursuing",
        capabilities: {
          set: true, edit: true, pause: true, resume: true, clear: true, fallbackMethod: null,
        },
      },
    });
  });

  it("rejects unsupported metadata versions and excessive nesting", () => {
    expect(normalizeAcpGoalMetadata({ _meta: { goal: { version: 99 } } })).toMatchObject({
      ok: false,
      reason: "unsupported_version",
    });
    let nested: Record<string, unknown> = {};
    for (let depth = 0; depth <= MAX_ACP_GOAL_NESTING_DEPTH; depth += 1) nested = { nested };
    expect(normalizeAcpGoalMetadata({ _meta: { goal: { version: 1, extra: nested } } })).toMatchObject({
      ok: false,
      reason: "too_deep",
    });
  });

  it("normalizes an explicit provider validation result", () => {
    expect(normalizeAcpGoalMetadata({
      _meta: {
        goal: {
          version: 1,
          status: "completed",
          validationState: {
            status: "passed",
            message: "All acceptance checks passed.",
            updatedAt: "2026-08-10T10:00:00.000Z",
          },
        },
      },
    })).toMatchObject({
      ok: true,
      value: {
        status: "completed",
        validationState: {
          status: "passed",
          message: "All acceptance checks passed.",
          updatedAt: "2026-08-10T10:00:00.000Z",
        },
      },
    });
  });

  it("normalizes core and experimental item plans with stable ids", () => {
    const context = { goalId: "goal-1", revision: 4 };
    const core = normalizeAcpGoalPlanUpdate({
      sessionUpdate: "plan",
      entries: [{ content: "Inspect", priority: "high", status: "in_progress" }],
    }, context);
    const experimental = normalizeAcpGoalPlanUpdate({
      sessionUpdate: "plan_update",
      plan: {
        type: "items",
        id: "provider-plan",
        entries: [{ content: "Inspect", priority: "high", status: "completed", _meta: { id: "provider-item" } }],
      },
    }, context);

    expect(core).toMatchObject({ ok: true, value: { planSource: { kind: "items" }, plan: [{ title: "Inspect", status: "in_progress", order: 0 }] } });
    expect(experimental).toMatchObject({
      ok: true,
      value: {
        providerPlanId: "provider-plan",
        planSource: { kind: "items" },
        plan: [{ id: "provider-item", providerId: "provider-item", title: "Inspect", status: "completed" }],
      },
    });
    const repeated = normalizeAcpGoalPlanUpdate({
      sessionUpdate: "plan",
      entries: [{ content: "Inspect", priority: "high", status: "in_progress" }],
    }, context);
    expect(core.ok && core.value.plan[0]?.id).toBe(repeated.ok && repeated.value.plan[0]?.id);
  });

  it("normalizes markdown, safe file URIs, and removal as atomic replacements", () => {
    const context = { goalId: "goal-1", revision: 2 };
    expect(normalizeAcpGoalPlanUpdate({ sessionUpdate: "plan_update", plan: { type: "markdown", id: "p1", content: "# Plan" } }, context)).toEqual({
      ok: true,
      value: { providerPlanId: "p1", plan: [], planSource: { kind: "markdown", markdown: "# Plan" }, removed: false },
    });
    expect(normalizeAcpGoalPlanUpdate({ sessionUpdate: "plan_update", plan: { type: "file", id: "p1", uri: "file:///tmp/plan.md" } }, context)).toEqual({
      ok: true,
      value: { providerPlanId: "p1", plan: [], planSource: { kind: "uri", uri: "file:///tmp/plan.md" }, removed: false },
    });
    expect(normalizeAcpGoalPlanUpdate({ sessionUpdate: "plan_removed", id: "p1" }, context)).toEqual({
      ok: true,
      value: { providerPlanId: "p1", plan: [], planSource: { kind: "none" }, removed: true },
    });
    expect(normalizeAcpGoalPlanUpdate({ sessionUpdate: "plan_update", plan: { type: "file", id: "p1", uri: "javascript:alert(1)" } }, context)).toMatchObject({ ok: false, reason: "unsafe_uri" });
  });

  it("rejects malformed plan fields without accepting a partial list", () => {
    expect(normalizeAcpGoalPlanUpdate({
      sessionUpdate: "plan_update",
      plan: {
        type: "items",
        id: "p1",
        entries: [
          { content: "Valid", priority: "high", status: "pending" },
          { content: "", priority: "low", status: "pending" },
        ],
      },
    }, { goalId: "goal-1", revision: 2 })).toMatchObject({ ok: false, reason: "empty_content", itemIndex: 1 });
  });
});
