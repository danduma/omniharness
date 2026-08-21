import { createHash } from "node:crypto";
import path from "node:path";
import type { GitBaseline } from "@/server/git/auto-commit";
import { runGit } from "@/server/git/command";
import type { HandoffModifiedFile } from "@/shared/handoff";
import { sanitizeProjectRelativePath } from "./redaction";

export type HandoffWorkspaceState = {
  projectRootLabel: string;
  baselineCommit: string | null;
  currentHead: string | null;
  dirtyBeforeSession: boolean | null;
  modifiedFiles: HandoffModifiedFile[];
  untrackedFiles: string[];
  commitsCreated: string[];
  fingerprint: string | null;
  warnings: string[];
};

type PorcelainEntry = { code: string; path: string; oldPath?: string };

function unquoteGitPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  try {
    return JSON.parse(trimmed) as string;
  } catch {
    return trimmed.slice(1, -1);
  }
}

export function parseGitPorcelain(value: string): PorcelainEntry[] {
  return value.split(/\r?\n/).flatMap((line) => {
    if (line.length < 4) return [];
    const code = line.slice(0, 2);
    const rawPath = line.slice(3);
    if (code.includes("R") && rawPath.includes(" -> ")) {
      const [oldValue, newValue] = rawPath.split(" -> ", 2);
      const safePath = sanitizeProjectRelativePath(unquoteGitPath(newValue ?? ""));
      const oldPath = sanitizeProjectRelativePath(unquoteGitPath(oldValue ?? ""));
      return safePath ? [{ code, path: safePath, ...(oldPath ? { oldPath } : {}) }] : [];
    }
    const safePath = sanitizeProjectRelativePath(unquoteGitPath(rawPath));
    return safePath ? [{ code, path: safePath }] : [];
  });
}

function changeType(code: string): HandoffModifiedFile["changeType"] {
  if (code === "??" || code.includes("A")) return "added";
  if (code.includes("D")) return "deleted";
  if (code.includes("R")) return "renamed";
  if (code.includes("U")) return "unmerged";
  return "modified";
}

export async function computeWorkspaceFingerprint(projectPath: string): Promise<string | null> {
  try {
    const rootResult = await runGit({ cwd: projectPath, args: ["rev-parse", "--show-toplevel"] });
    const repoRoot = rootResult.stdout.trim();
    const [head, unstaged, staged] = await Promise.all([
      runGit({ cwd: repoRoot, args: ["rev-parse", "HEAD"], allowExitCodes: [0, 128] }),
      runGit({ cwd: repoRoot, args: ["diff", "--binary", "--no-ext-diff"] }),
      runGit({ cwd: repoRoot, args: ["diff", "--cached", "--binary", "--no-ext-diff"] }),
    ]);
    return createHash("sha256")
      .update([head.stdout.trim(), unstaged.stdout.normalize("NFC"), staged.stdout.normalize("NFC")].join("\u0000"))
      .digest("hex");
  } catch {
    return null;
  }
}

export async function collectHandoffWorkspaceState(args: {
  projectPath: string;
  baseline: GitBaseline | null;
}): Promise<HandoffWorkspaceState> {
  const projectRootLabel = path.basename(path.resolve(args.projectPath));
  try {
    const rootResult = await runGit({ cwd: args.projectPath, args: ["rev-parse", "--show-toplevel"] });
    const repoRoot = rootResult.stdout.trim();
    // Keep evidence reads ordered. Git has no cross-command snapshot primitive;
    // launch performs a fresh fingerprint comparison before creating the target.
    const head = await runGit({ cwd: repoRoot, args: ["rev-parse", "HEAD"], allowExitCodes: [0, 128] });
    const status = await runGit({ cwd: repoRoot, args: ["status", "--porcelain=v1", "--untracked-files=all"] });
    const fingerprint = await computeWorkspaceFingerprint(repoRoot);
    const entries = parseGitPorcelain(status.stdout);
    const baselineEntries = new Map(parseGitPorcelain(args.baseline?.status === "ok" ? args.baseline.porcelain : "").map((entry) => [entry.path, entry]));
    const currentHead = head.exitCode === 0 ? head.stdout.trim() || null : null;
    let commitsCreated: string[] = [];
    if (args.baseline?.status === "ok" && args.baseline.headSha && currentHead && args.baseline.headSha !== currentHead) {
      const commits = await runGit({ cwd: repoRoot, args: ["rev-list", "--reverse", `${args.baseline.headSha}..${currentHead}`], allowExitCodes: [0, 128] });
      if (commits.exitCode === 0) commitsCreated = commits.stdout.split(/\s+/).filter(Boolean).slice(0, 100);
    }
    const modifiedFiles = entries.map((entry): HandoffModifiedFile => ({
      path: entry.path,
      changeType: changeType(entry.code),
      ownership: baselineEntries.has(entry.path) ? "preexisting" : "probable_session",
      summary: null,
      evidence: [baselineEntries.has(entry.path) ? "Present in the run git baseline." : "Absent from the run git baseline; attribution is probabilistic."],
    })).sort((left, right) => left.path.localeCompare(right.path));
    return {
      projectRootLabel: path.basename(repoRoot),
      baselineCommit: args.baseline?.status === "ok" ? args.baseline.headSha : null,
      currentHead,
      dirtyBeforeSession: args.baseline?.status === "ok" ? !args.baseline.clean : null,
      modifiedFiles,
      untrackedFiles: entries.filter((entry) => entry.code === "??").map((entry) => entry.path).sort(),
      commitsCreated,
      fingerprint,
      warnings: entries.some((entry) => entry.code === "??")
        ? ["Untracked files are listed but excluded from the launch drift fingerprint."]
        : [],
    };
  } catch (error) {
    return {
      projectRootLabel,
      baselineCommit: args.baseline?.status === "ok" ? args.baseline.headSha : null,
      currentHead: null,
      dirtyBeforeSession: args.baseline?.status === "ok" ? !args.baseline.clean : null,
      modifiedFiles: [],
      untrackedFiles: [],
      commitsCreated: [],
      fingerprint: null,
      warnings: [error instanceof Error ? error.message : "Workspace is not a readable git repository."],
    };
  }
}
