import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectReviewDiff } from "@/server/review/diff";
import {
  buildCodeReviewerPrompt,
  buildImplementerFixPrompt,
  extractJsonBlock,
  parseCodeReviewVerdict,
  parseImplementerDisputes,
  verdictHasEvidence,
} from "@/server/review/prompts";

describe("code review verdict parsing", () => {
  it("reads the last fenced json block and fills defaults", () => {
    const text = "thinking...\n```json\n{\"verdict\":\"request_changes\"}\n```\nfinal:\n```json\n{\"verdict\":\"approve\",\"filesInspected\":[\"src/a.ts\"]}\n```";
    const parsed = parseCodeReviewVerdict(text);
    expect(parsed).toEqual({
      ok: true,
      verdict: { verdict: "approve", findings: [], previousFindings: [], filesInspected: ["src/a.ts"], testsRun: [] },
    });
  });

  it("accepts an unfenced trailing object and rejects invalid verdicts", () => {
    expect(extractJsonBlock("All good. {\"verdict\":\"approve\",\"testsRun\":[\"pnpm test\"]}")).toBe("{\"verdict\":\"approve\",\"testsRun\":[\"pnpm test\"]}");
    expect(parseCodeReviewVerdict("no json here")).toMatchObject({ ok: false });
    expect(parseCodeReviewVerdict("```json\n{not json}\n```")).toMatchObject({ ok: false });
    expect(parseCodeReviewVerdict("```json\n{\"verdict\":\"lgtm\"}\n```")).toMatchObject({ ok: false });
    expect(parseCodeReviewVerdict("```json\n{\"verdict\":\"approve\",\"findings\":[{\"severity\":\"huge\",\"claim\":\"x\"}]}\n```")).toMatchObject({ ok: false });
  });

  it("requires evidence: files inspected, tests run, or a located finding", () => {
    const base = { verdict: "approve" as const, findings: [], previousFindings: [], filesInspected: [], testsRun: [] };
    expect(verdictHasEvidence(base)).toBe(false);
    expect(verdictHasEvidence({ ...base, filesInspected: ["a.ts"] })).toBe(true);
    expect(verdictHasEvidence({ ...base, testsRun: ["pnpm test"] })).toBe(true);
    expect(verdictHasEvidence({ ...base, findings: [{ severity: "minor", claim: "x", file: "a.ts", line: 3 }] })).toBe(true);
    expect(verdictHasEvidence({ ...base, findings: [{ severity: "minor", claim: "x", file: "a.ts" }] })).toBe(false);
  });

  it("parses implementer disputes and ignores malformed blocks", () => {
    expect(parseImplementerDisputes("Fixed.\n```json\n{\"disputes\":[{\"id\":\"f1\",\"reason\":\"intended\"}]}\n```")).toEqual([{ id: "f1", reason: "intended" }]);
    expect(parseImplementerDisputes("Fixed everything.")).toEqual([]);
    expect(parseImplementerDisputes("```json\n{\"disputes\":\"none\"}\n```")).toEqual([]);
  });

  it("builds prompts that forbid edits, carry earlier findings, and ask for disputes", () => {
    const previous = [{ id: "f1", severity: "major" as const, file: "src/a.ts", line: 4, claim: "Leaks a handle", status: "disputed", disputeReason: "Closed in finally" }];
    const reviewer = buildCodeReviewerPrompt({
      round: 2, maxRounds: 3, task: "Add caching", implementerType: "codex", diff: "+x", stat: "a.ts | 1 +", untracked: ["new.ts"], truncated: true,
      implementerSummary: "Done", previousFindings: previous,
    });
    expect(reviewer).toContain("Do NOT edit");
    expect(reviewer).toContain("id f1 [major] src/a.ts:4 (disputed): Leaks a handle");
    expect(reviewer).toContain("Implementer disputes this: Closed in finally");
    expect(reviewer).toContain("TRUNCATED");
    expect(reviewer).toContain("new.ts");
    expect(buildImplementerFixPrompt({ round: 1, reviewerType: "claude", findings: previous })).toContain("\"disputes\"");
  });
});

describe("collectReviewDiff", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  function repo() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-review-diff-"));
    dirs.push(dir);
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
    git("init", "-q");
    git("config", "user.email", "test@example.invalid");
    git("config", "user.name", "Test");
    fs.writeFileSync(path.join(dir, "a.ts"), "export const a = 1;\n");
    git("add", ".");
    git("commit", "-q", "-m", "base");
    return { dir, git, base: git("rev-parse", "HEAD") };
  }

  it("diffs the working tree against the baseline, lists untracked files, and redacts secrets", () => {
    const { dir, git, base } = repo();
    fs.writeFileSync(path.join(dir, "a.ts"), "export const a = 2;\nconst key = \"vck_TESTONLY_placeholder_0000\";\n");
    fs.writeFileSync(path.join(dir, "b.ts"), "export const b = 1;\n");
    git("add", "b.ts");
    git("commit", "-q", "-m", "after baseline");
    fs.writeFileSync(path.join(dir, "new.ts"), "x\n");

    const diff = collectReviewDiff(dir, base);
    if (!diff.ok) throw new Error("expected a diff");
    expect(diff.base).toBe(base);
    expect(diff.diff).toContain("+export const a = 2;");
    expect(diff.diff).toContain("+export const b = 1;");
    expect(diff.diff).not.toContain("vck_TESTONLY");
    expect(diff.stat).toContain("a.ts");
    expect(diff.untracked).toEqual(["new.ts"]);
    expect(diff.truncated).toBe(false);
  });

  it("truncates large diffs and reports non-git folders", () => {
    const { dir } = repo();
    fs.writeFileSync(path.join(dir, "a.ts"), "x".repeat(5_000));
    const diff = collectReviewDiff(dir, null, 1_000);
    if (!diff.ok) throw new Error("expected a diff");
    expect(diff.truncated).toBe(true);
    expect(diff.diff.length).toBeLessThanOrEqual(1_000);
    expect(diff.chars).toBeGreaterThan(1_000);

    const plain = fs.mkdtempSync(path.join(os.tmpdir(), "omni-review-plain-"));
    dirs.push(plain);
    expect(collectReviewDiff(plain, null)).toMatchObject({ ok: false, reason: "not_git" });
  });
});
