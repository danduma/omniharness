import { describe, expect, it } from "vitest";
import { parsePlan } from "@/server/plans/parser";

describe("parsePlan", () => {
  it("extracts phases and checklist items from markdown", () => {
    const result = parsePlan(`# Plan

## Phase 1
- [ ] First task
- [ ] Second task

## Phase 2
- [ ] Third task
`);

    expect(result.items.map((item) => item.title)).toEqual([
      "First task",
      "Second task",
      "Third task",
    ]);
    expect(result.items.map((item) => item.phase)).toEqual([
      "Phase 1",
      "Phase 1",
      "Phase 2",
    ]);
  });
});
