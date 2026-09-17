import { execFile } from "child_process";
import fs from "fs";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface GitCommandResult {
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface RunGitOptions {
  cwd: string;
  args: string[];
  timeoutMs?: number;
  allowExitCodes?: number[];
}

export class GitCommandError extends Error {
  readonly code: string;
  readonly command: string;
  readonly args: string[];
  readonly cwd: string;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, options: {
    code: string;
    args: string[];
    cwd: string;
    exitCode?: number | null;
    stdout?: string;
    stderr?: string;
  }) {
    super(message);
    this.name = "GitCommandError";
    this.code = options.code;
    this.command = "git";
    this.args = options.args;
    this.cwd = options.cwd;
    this.exitCode = options.exitCode ?? null;
    this.stdout = options.stdout ?? "";
    this.stderr = options.stderr ?? "";
  }
}

function assertSafeCwd(cwd: string) {
  if (!cwd || !cwd.startsWith("/")) {
    throw new GitCommandError("Git command cwd must be an absolute path.", {
      code: "invalid_git_cwd",
      args: [],
      cwd,
    });
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(cwd);
  } catch {
    throw new GitCommandError("Git command cwd does not exist.", {
      code: "missing_git_cwd",
      args: [],
      cwd,
    });
  }
  if (!stat.isDirectory()) {
    throw new GitCommandError("Git command cwd must be a directory.", {
      code: "invalid_git_cwd",
      args: [],
      cwd,
    });
  }
}

export async function runGit(options: RunGitOptions): Promise<GitCommandResult> {
  assertSafeCwd(options.cwd);
  const allowExitCodes = new Set(options.allowExitCodes ?? [0]);
  try {
    const result = await execFileAsync("git", options.args, {
      cwd: options.cwd,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 10,
      timeout: options.timeoutMs ?? 15_000,
    });
    return {
      command: "git",
      args: options.args,
      cwd: options.cwd,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
    };
  } catch (error) {
    const failure = error as {
      code?: number | string;
      signal?: string;
      stdout?: string;
      stderr?: string;
      killed?: boolean;
      message?: string;
    };
    const exitCode = typeof failure.code === "number" ? failure.code : null;
    if (exitCode !== null && allowExitCodes.has(exitCode)) {
      return {
        command: "git",
        args: options.args,
        cwd: options.cwd,
        stdout: failure.stdout ?? "",
        stderr: failure.stderr ?? "",
        exitCode,
      };
    }
    const timedOut = failure.killed || failure.signal === "SIGTERM";
    throw new GitCommandError(timedOut ? "Git command timed out." : failure.message ?? "Git command failed.", {
      code: timedOut ? "git_command_timeout" : "git_command_failed",
      args: options.args,
      cwd: options.cwd,
      exitCode,
      stdout: failure.stdout,
      stderr: failure.stderr,
    });
  }
}
