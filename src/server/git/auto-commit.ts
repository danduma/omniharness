import { spawnSync } from "child_process";
import { existsSync, statSync } from "fs";
import * as path from "path";

export type GitBaseline =
  | {
      status: "ok";
      repoRoot: string;
      headSha: string | null;
      clean: boolean;
      porcelain: string;
      capturedAt?: number;
    }
  | {
      status: "not_git";
      reason: string;
    };

export type AutoCommitResult =
  | {
      status: "created";
      commitSha: string;
      subject: string;
      pushStatus: "not_requested" | "pushed" | "failed";
      pushError?: string;
    }
  | {
      status: "skipped";
      reason: "disabled" | "not_git" | "no_changes";
      details?: string;
    }
  | {
      status: "failed";
      reason: string;
      stderr?: string;
    };

type GitCommandResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: number | null;
};

function runGit(cwd: string, args: string[], options: { trimStdout?: boolean } = {}): GitCommandResult {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    maxBuffer: 1024 * 1024,
  });

  const stdout = typeof result.stdout === "string"
    ? options.trimStdout === false
      ? result.stdout.replace(/\r?\n$/, "")
      : result.stdout.trim()
    : "";
  const stderr = typeof result.stderr === "string" ? result.stderr.trim() : "";

  return {
    ok: !result.error && result.status === 0,
    stdout,
    stderr: result.error instanceof Error ? [stderr, result.error.message].filter(Boolean).join("\n") : stderr,
    status: result.status,
  };
}

function formatGitFailure(command: string, result: GitCommandResult) {
  return [
    `git ${command} failed`,
    result.stderr,
    result.stdout,
  ].filter(Boolean).join(": ");
}

export function captureGitBaseline(cwd: string): GitBaseline {
  const repoRoot = runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (!repoRoot.ok || !repoRoot.stdout) {
    return {
      status: "not_git",
      reason: repoRoot.stderr || "Not inside a git repository.",
    };
  }

  const head = runGit(repoRoot.stdout, ["rev-parse", "HEAD"]);
  const status = runGit(repoRoot.stdout, ["status", "--porcelain"], { trimStdout: false });

  return {
    status: "ok",
    repoRoot: repoRoot.stdout,
    headSha: head.ok ? head.stdout : null,
    clean: status.ok && status.stdout.length === 0,
    porcelain: status.stdout,
    capturedAt: Date.now(),
  };
}

export function parseGitBaselineJson(value: string | null | undefined): GitBaseline | null {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as GitBaseline;
    if (parsed.status === "ok" || parsed.status === "not_git") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function parsePorcelain(stdout: string): Map<string, string> {
  const fileMap = new Map<string, string>();
  if (!stdout) return fileMap;

  const lines = stdout.split("\n");
  for (const line of lines) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    let pathPart = line.slice(3).trim();

    // Remove quotes if git quoted the path
    if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
      pathPart = pathPart.slice(1, -1);
    }

    if (status.includes("R")) {
      const parts = pathPart.split(" -> ");
      if (parts.length === 2) {
        const oldPath = parts[0].trim();
        const newPath = parts[1].trim();
        fileMap.set(oldPath, status);
        fileMap.set(newPath, status);
        continue;
      }
    }

    fileMap.set(pathPart, status);
  }
  return fileMap;
}

export function autoCommitMilestone({
  cwd,
  baseline,
  autoCommitMilestones,
  pushOnCommit,
  subject,
  body,
}: {
  cwd: string;
  baseline: GitBaseline | null;
  autoCommitMilestones: boolean;
  pushOnCommit: boolean;
  subject: string;
  body: string;
}): AutoCommitResult {
  if (!autoCommitMilestones) {
    return { status: "skipped", reason: "disabled" };
  }

  if (!baseline || baseline.status === "not_git") {
    return { status: "skipped", reason: "not_git", details: baseline?.reason };
  }

  const current = captureGitBaseline(cwd);
  if (current.status === "not_git") {
    return { status: "skipped", reason: "not_git", details: current.reason };
  }

  const status = runGit(current.repoRoot, ["status", "--porcelain"], { trimStdout: false });
  if (!status.ok) {
    return { status: "failed", reason: "status_failed", stderr: formatGitFailure("status --porcelain", status) };
  }

  if (!status.stdout) {
    return { status: "skipped", reason: "no_changes" };
  }

  const baselineFiles = parsePorcelain(baseline.status === "ok" ? baseline.porcelain : "");
  const currentFiles = parsePorcelain(status.stdout);

  const touchedFiles: string[] = [];

  for (const [file, currentStatus] of currentFiles.entries()) {
    const baselineStatus = baselineFiles.get(file);

    if (baselineStatus === undefined) {
      // File was clean at baseline and is now dirty -> touched
      touchedFiles.push(file);
    } else if (baselineStatus !== currentStatus) {
      // Status changed (e.g. staged vs unstaged, or untracked to modified, etc.) -> touched
      touchedFiles.push(file);
    } else {
      // Status is exactly the same. Check mtime if we have capturedAt.
      if (baseline.status === "ok" && typeof baseline.capturedAt === "number") {
        const absPath = path.resolve(current.repoRoot, file);
        if (existsSync(absPath)) {
          try {
            const stat = statSync(absPath);
            if (stat.mtimeMs >= baseline.capturedAt) {
              touchedFiles.push(file);
            }
          } catch {
            // Be conservative, don't assume touched if stat fails
          }
        }
      }
    }
  }

  if (touchedFiles.length === 0) {
    return { status: "skipped", reason: "no_changes" };
  }

  if (baseline.status === "ok" && baseline.headSha) {
    const reset = runGit(current.repoRoot, ["reset"]);
    if (!reset.ok) {
      return { status: "failed", reason: "reset_failed", stderr: formatGitFailure("reset", reset) };
    }
  }

  const add = runGit(current.repoRoot, ["add", "--", ...touchedFiles]);
  if (!add.ok) {
    return { status: "failed", reason: "add_failed", stderr: formatGitFailure("add", add) };
  }

  const commit = runGit(current.repoRoot, ["commit", "-m", subject, "-m", body]);
  if (!commit.ok) {
    return { status: "failed", reason: "commit_failed", stderr: formatGitFailure("commit", commit) };
  }

  const sha = runGit(current.repoRoot, ["rev-parse", "HEAD"]);
  if (!sha.ok || !sha.stdout) {
    return { status: "failed", reason: "rev_parse_failed", stderr: formatGitFailure("rev-parse HEAD", sha) };
  }

  if (!pushOnCommit) {
    return {
      status: "created",
      commitSha: sha.stdout,
      subject,
      pushStatus: "not_requested",
    };
  }

  const push = runGit(current.repoRoot, ["push"]);
  return {
    status: "created",
    commitSha: sha.stdout,
    subject,
    pushStatus: push.ok ? "pushed" : "failed",
    ...(push.ok ? {} : { pushError: formatGitFailure("push", push) }),
  };
}
