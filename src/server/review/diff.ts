import { spawnSync } from "node:child_process";
import { redactHandoffText } from "@/server/handoff/redaction";

/** Diff text handed to a reviewer is capped; the reviewer can read files itself. */
export const REVIEW_DIFF_MAX_CHARS = 60_000;
const UNTRACKED_MAX = 200;

export type CodeReviewDiff =
  | {
      ok: true;
      base: string;
      diff: string;
      stat: string;
      untracked: string[];
      truncated: boolean;
      /** Length of the full diff before truncation. */
      chars: number;
    }
  | { ok: false; reason: "not_git" | "git_failed"; detail: string };

function git(cwd: string, args: string[]) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 });
  return {
    ok: !result.error && result.status === 0,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: (typeof result.stderr === "string" ? result.stderr : "") || (result.error?.message ?? ""),
  };
}

/**
 * Collect the change under review: everything in the working tree relative to
 * the run's baseline commit (or HEAD when the run has none), plus untracked
 * files. Redacted (secrets, machine paths) and capped before it leaves here.
 */
export function collectReviewDiff(cwd: string, baselineSha: string | null, maxChars = REVIEW_DIFF_MAX_CHARS): CodeReviewDiff {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (!root.ok || !root.stdout.trim()) {
    return { ok: false, reason: "not_git", detail: redactHandoffText(root.stderr || "Not inside a git repository.", 300) };
  }
  const repoRoot = root.stdout.trim();
  const base = baselineSha?.trim() || "HEAD";
  const diff = git(repoRoot, ["diff", "--no-color", "--no-ext-diff", base]);
  if (!diff.ok) {
    return { ok: false, reason: "git_failed", detail: redactHandoffText(diff.stderr || `git diff ${base} failed`, 300) };
  }
  const stat = git(repoRoot, ["diff", "--stat", "--no-color", base]);
  const untracked = git(repoRoot, ["ls-files", "--others", "--exclude-standard"]);
  const fullChars = diff.stdout.length;
  const truncated = fullChars > maxChars;
  return {
    ok: true,
    base,
    diff: redactHandoffText(diff.stdout, maxChars),
    stat: redactHandoffText(stat.ok ? stat.stdout.trim() : "", 8_000),
    untracked: untracked.ok
      ? untracked.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, UNTRACKED_MAX)
      : [],
    truncated,
    chars: fullChars,
  };
}
