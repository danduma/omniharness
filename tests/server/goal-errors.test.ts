import { describe, expect, it } from "vitest";
import { redactGoalErrorMessage } from "@/server/runs/goal-errors";

describe("goal error redaction", () => {
  it("removes credentials and bounds provider diagnostics", () => {
    const redacted = redactGoalErrorMessage(
      `Bearer secret-token api_key=sk-live-secret password: hunter2 https://user:pass@example.com/${"x".repeat(2_000)}`,
    );
    expect(redacted).not.toContain("secret-token");
    expect(redacted).not.toContain("sk-live-secret");
    expect(redacted).not.toContain("hunter2");
    expect(redacted).not.toContain("user:pass@");
    expect(redacted).toContain("[redacted]");
    expect(redacted.length).toBeLessThanOrEqual(1_000);
  });
});
