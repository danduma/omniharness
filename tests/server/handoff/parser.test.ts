import { describe, expect, it } from "vitest";
import { extractHandoffBlock, parseHandoffReply } from "@/server/handoff/parser";

describe("extractHandoffBlock", () => {
  it("extracts the inner content of the fenced handoff block", () => {
    const text = "Some preamble\n```omniharness-handoff\nTASK: foo\nPROGRESS: bar\n```\nTrailing.";
    expect(extractHandoffBlock(text)).toBe("TASK: foo\nPROGRESS: bar");
  });

  it("returns null when no block is present", () => {
    expect(extractHandoffBlock("nothing here")).toBeNull();
  });
});

describe("parseHandoffReply", () => {
  it("parses a happy-path handoff with all required fields and optional ones", () => {
    const text = [
      "```omniharness-handoff",
      "TASK: Refactor the auth middleware",
      "PROGRESS: Wrote tests and implemented redirect",
      "NEXT_STEPS: Run integration tests, then update docs",
      "BLOCKERS: none",
      "OPEN_QUESTIONS: should we keep the legacy header?",
      "RELEVANT_FILES: src/auth.ts, src/middleware.ts",
      "```",
    ].join("\n");

    const result = parseHandoffReply({
      text,
      outgoingWorkerType: "codex",
      outgoingWorkerId: "w1",
      reason: "quota_exhausted",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report).toMatchObject({
      task: "Refactor the auth middleware",
      progress: "Wrote tests and implemented redirect",
      nextSteps: "Run integration tests, then update docs",
      blockers: "none",
      openQuestions: "should we keep the legacy header?",
      relevantFiles: ["src/auth.ts", "src/middleware.ts"],
      source: "worker",
      outgoingWorkerId: "w1",
      reason: "quota_exhausted",
    });
  });

  it("accepts optional fields being absent", () => {
    const text = [
      "```omniharness-handoff",
      "TASK: do thing",
      "PROGRESS: started",
      "NEXT_STEPS: finish",
      "```",
    ].join("\n");

    const result = parseHandoffReply({
      text,
      outgoingWorkerType: "claude",
      outgoingWorkerId: "w1",
      reason: "test",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.blockers).toBeUndefined();
    expect(result.report.relevantFiles).toBeUndefined();
  });

  it("returns missing_required_fields when a required field is absent", () => {
    const text = [
      "```omniharness-handoff",
      "TASK: do thing",
      "PROGRESS: started",
      "```",
    ].join("\n");

    const result = parseHandoffReply({
      text,
      outgoingWorkerType: "codex",
      outgoingWorkerId: "w1",
      reason: "test",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("missing_required_fields");
    expect(result.missing).toContain("nextSteps");
  });

  it("returns no_block when no fenced handoff block is present", () => {
    const result = parseHandoffReply({
      text: "I'm sorry, I can't continue. Quota exhausted.",
      outgoingWorkerType: "codex",
      outgoingWorkerId: "w1",
      reason: "test",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_block");
  });

  it("handles multi-line field values within the block", () => {
    const text = [
      "```omniharness-handoff",
      "TASK: long task",
      "PROGRESS: did step 1",
      "  then step 2",
      "  then step 3",
      "NEXT_STEPS: finish step 4",
      "```",
    ].join("\n");

    const result = parseHandoffReply({
      text,
      outgoingWorkerType: "codex",
      outgoingWorkerId: "w1",
      reason: "test",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.progress).toContain("step 1");
    expect(result.report.progress).toContain("step 3");
  });
});
