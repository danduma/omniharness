import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

describe("planning review UI implementation", () => {
  it("implements PlanningReviewControls.tsx without hardcoded English strings", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/PlanningReviewControls.tsx"), "utf8");
    expect(src).toContain("planning.review.expand");
    expect(src).toContain("planning.review.start");
    expect(src).toContain("planningReviewPreferencesManager");
    expect(src).toContain("setAgentSelection");
    expect(src).toContain("setRounds");
  });

  it("implements PlanningReviewPreferencesManager.ts correctly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/app/home/PlanningReviewPreferencesManager.ts"), "utf8");
    expect(src).toContain("PLANNING_REVIEW_AGENT_SELECTION");
    expect(src).toContain("PLANNING_REVIEW_ROUNDS");
    expect(src).toContain("setAgentSelection");
  });

  it("wires up PlanningArtifactsPanel.tsx correctly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/PlanningArtifactsPanel.tsx"), "utf8");
    expect(src).toContain("<PlanningReviewControls");
    expect(src).toContain("onStartReview={onStartReview}");
  });
});
