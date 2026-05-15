import { describe, expect, it } from "vitest";

import { parsePlan } from "@/server/plans/parser";
import {
  assessPlanStructure,
  describeStructuralGaps,
  structureHasBlockingGaps,
} from "@/server/plans/readiness";

describe("assessPlanStructure", () => {
  it("flags an empty plan", () => {
    const plan = parsePlan("# Notes\n");
    const facts = assessPlanStructure(plan);
    expect(facts.itemCount).toBe(0);
    expect(structureHasBlockingGaps(facts)).toBe(true);
    expect(describeStructuralGaps(plan, facts)).toContain("No checklist items were found in the plan.");
  });

  it("flags stub item titles", () => {
    const plan = parsePlan("## Phase 1\n- [ ] TODO\n- [ ] Real task\n  - Verify: file exists\n");
    const facts = assessPlanStructure(plan);
    expect(facts.itemsWithStubTitle).toContain(0);
    expect(structureHasBlockingGaps(facts)).toBe(true);
    const gaps = describeStructuralGaps(plan, facts);
    expect(gaps.some((gap) => gap.includes("stub"))).toBe(true);
  });

  it("does not flag a well-formed plan as blocking", () => {
    const plan = parsePlan([
      "## Phase 1",
      "- [ ] Wire the readiness pipeline",
      "  - Detail: add module",
      "  - Verify: tsc passes",
      "## Acceptance Criteria",
      "- pipeline runs once per hash",
    ].join("\n"));
    const facts = assessPlanStructure(plan);
    expect(structureHasBlockingGaps(facts)).toBe(false);
    expect(describeStructuralGaps(plan, facts)).toHaveLength(0);
  });

  it("flags vague-titled items only when there are no compensating signals", () => {
    const planWithoutSupport = parsePlan("## Phase 1\n- [ ] Improve auth\n");
    const factsWithout = assessPlanStructure(planWithoutSupport);
    expect(factsWithout.itemsWithVagueTitle).toContain(0);
    expect(structureHasBlockingGaps(factsWithout)).toBe(true);

    const planWithVerify = parsePlan([
      "## Phase 1",
      "- [ ] Improve auth",
      "  - Verify: cookie has Secure flag",
    ].join("\n"));
    const factsWith = assessPlanStructure(planWithVerify);
    expect(factsWith.itemsWithVagueTitle).toContain(0);
    expect(structureHasBlockingGaps(factsWith)).toBe(false);
  });
});
