import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const reviewSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/planning/review.ts"),
  "utf8",
);

describe("planning review planner recovery source guards", () => {
  it("does not treat every planner getAgent failure as a missing session", () => {
    expect(reviewSource).toContain("function isRecoverablePlannerAgentMissingError(error: unknown)");
    expect(reviewSource).toContain("} catch (error) {\n          if (!isRecoverablePlannerAgentMissingError(error)) {\n            throw error;\n          }");
  });

  it("records durable planner session branch events before revising the plan", () => {
    expect(reviewSource).toContain('eventType: "worker_session_resumed"');
    expect(reviewSource).toContain('eventType: "worker_session_recreated"');
    expect(reviewSource).toContain('kind: "worker.reattached"');
    expect(reviewSource).toContain('kind: "worker.recreated"');
  });
});
