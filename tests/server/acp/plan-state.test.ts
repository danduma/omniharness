import { describe, expect, it } from "vitest";
import {
  classifyAcpPlanUpdate,
  createBoundaryScopedPlanItems,
  normalizeAcpCorePlan,
} from "@/server/agent-runtime/acp/plan-state";

describe("ACP plan state", () => {
  it("classifies core and experimental plan notifications without guessing their semantics", () => {
    expect(classifyAcpPlanUpdate({ sessionUpdate: "plan", entries: [] })).toBe("core");
    expect(classifyAcpPlanUpdate({ sessionUpdate: "plan_update", plan: "# Work" })).toBe("unsupported");
    expect(classifyAcpPlanUpdate({ sessionUpdate: "plan_removed", id: "provider-plan" })).toBe("unsupported");
    expect(classifyAcpPlanUpdate({ sessionUpdate: "agent_message_chunk" })).toBe("not_plan");
  });

  it("creates render keys scoped to the durable session boundary", () => {
    const normalized = normalizeAcpCorePlan({
      sessionUpdate: "plan",
      entries: [
        { content: "Inspect", priority: "high", status: "in_progress" },
        { content: "Verify", priority: "medium", status: "pending" },
      ],
    });
    if (!normalized.ok) throw new Error(normalized.reason);

    expect(createBoundaryScopedPlanItems(42, normalized.items).map((item) => item.id)).toEqual([
      "42:0",
      "42:1",
    ]);
  });
});
