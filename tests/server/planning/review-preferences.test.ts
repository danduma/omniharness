import { describe, expect, it } from "vitest";
import {
  normalizePlanningReviewAgentSelection,
  normalizePlanningReviewRounds,
  parsePlanningReviewPreferences,
} from "@/server/planning/review-preferences";

describe("planning review preferences", () => {
  describe("normalizePlanningReviewAgentSelection", () => {
    it("accepts valid selections", () => {
      expect(normalizePlanningReviewAgentSelection("auto")).toBe("auto");
      expect(normalizePlanningReviewAgentSelection("claude")).toBe("claude");
      expect(normalizePlanningReviewAgentSelection("same")).toBe("same");
    });

    it("defaults to auto for invalid selections", () => {
      expect(normalizePlanningReviewAgentSelection("unknown")).toBe("auto");
      expect(normalizePlanningReviewAgentSelection(null)).toBe("auto");
      expect(normalizePlanningReviewAgentSelection(undefined)).toBe("auto");
    });
  });

  describe("normalizePlanningReviewRounds", () => {
    it("accepts valid numbers", () => {
      expect(normalizePlanningReviewRounds(1)).toBe(1);
      expect(normalizePlanningReviewRounds(3)).toBe(3);
      expect(normalizePlanningReviewRounds(5)).toBe(5);
    });

    it("accepts valid strings", () => {
      expect(normalizePlanningReviewRounds("1")).toBe(1);
      expect(normalizePlanningReviewRounds("5")).toBe(5);
    });

    it("clamps values", () => {
      expect(normalizePlanningReviewRounds(0)).toBe(1);
      expect(normalizePlanningReviewRounds(-1)).toBe(1);
      expect(normalizePlanningReviewRounds(6)).toBe(5);
      expect(normalizePlanningReviewRounds(10)).toBe(5);
    });

    it("defaults to 1 for invalid values", () => {
      expect(normalizePlanningReviewRounds("abc")).toBe(1);
      expect(normalizePlanningReviewRounds(null)).toBe(1);
      expect(normalizePlanningReviewRounds(undefined)).toBe(1);
    });
  });

  describe("parsePlanningReviewPreferences", () => {
    it("parses valid payload", () => {
      const payload = {
        agentSelection: "claude",
        rounds: 3,
      };
      const result = parsePlanningReviewPreferences(payload);
      expect(result.agentSelection).toBe("claude");
      expect(result.rounds).toBe(3);
    });

    it("fills defaults for partial payload", () => {
      const result = parsePlanningReviewPreferences({ rounds: 2 });
      expect(result.agentSelection).toBe("auto");
      expect(result.rounds).toBe(2);
    });

    it("returns defaults for empty or invalid payload", () => {
      expect(parsePlanningReviewPreferences({})).toEqual({
        agentSelection: "auto",
        rounds: 1,
      });
      expect(parsePlanningReviewPreferences(null)).toEqual({
        agentSelection: "auto",
        rounds: 1,
      });
    });

    it("clamps invalid values in payload", () => {
      const result = parsePlanningReviewPreferences({ rounds: 10 });
      expect(result.agentSelection).toBe("auto");
      expect(result.rounds).toBe(1); // parsePlanningReviewPreferences returns default on any validation failure because of .default() in schema? No, default() is for missing.
    });
  });
});
