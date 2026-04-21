import { describe, expect, it } from "vitest";
import { buildSupervisorConversation } from "@/server/supervisor/conversation-bootstrap";

describe("buildSupervisorConversation", () => {
  it("hydrates the first model call from persisted user checkpoints", () => {
    const result = buildSupervisorConversation([
      { role: "user", kind: "checkpoint", content: "retry the failing run" },
      { role: "supervisor", content: "# Wiki.js migration plan" },
      { role: "system", kind: "error", content: "Run failed: API key not valid" },
    ], "# Ad Hoc Request");

    expect(result).toEqual([
      { role: "user", content: "retry the failing run" },
    ]);
  });

  it("falls back to the plan content when no persisted user messages exist", () => {
    const result = buildSupervisorConversation([], "# Ad Hoc Request\n\n## Checklist\n\n- [ ] Fix the bug");

    expect(result).toEqual([
      {
        role: "user",
        content: "Execute this request:\n\n# Ad Hoc Request\n\n## Checklist\n\n- [ ] Fix the bug",
      },
    ]);
  });
});
