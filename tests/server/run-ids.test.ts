import { describe, expect, it } from "vitest";
import { createRunId, RUN_ID_PATTERN } from "@/server/runs/ids";

describe("run identifiers", () => {
  it("creates short UUID-derived run ids for new conversations", () => {
    const runId = createRunId();

    expect(runId).toMatch(/^[0-9a-f]{12}$/);
    expect(runId).toMatch(RUN_ID_PATTERN);
  });

  it("keeps compatibility with legacy UUID run ids", () => {
    expect("f1dfb77c-97e2-4f6c-b5a3-75a6ccb5e7ef").toMatch(RUN_ID_PATTERN);
  });
});
