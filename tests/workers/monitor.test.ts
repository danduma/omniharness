import { describe, expect, it } from "vitest";
import { classifyWorkerHealth } from "@/server/workers/monitor";

describe("classifyWorkerHealth", () => {
  it("marks a worker stuck after prolonged silence", () => {
    expect(
      classifyWorkerHealth({
        silenceMs: 30000,
        repeatCount: 0,
        unresolvedItems: 1,
        stderr: "",
      }),
    ).toBe("stuck");
  });

  it("marks a worker cred-exhausted on quota errors", () => {
    expect(
      classifyWorkerHealth({
        silenceMs: 1000,
        repeatCount: 0,
        unresolvedItems: 1,
        stderr: "HTTP 429 quota exceeded",
      }),
    ).toBe("cred-exhausted");
  });
});
