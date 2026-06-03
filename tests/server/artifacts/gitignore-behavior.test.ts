/**
 * Sanity-check that the project-local artifact tree is excluded by the
 * top-level .gitignore. If someone removes or rewrites the exclude
 * pattern, this test fails loudly so we don't accidentally commit
 * gigabytes of run data.
 */
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function gitCheckIgnore(targetPath: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "-q", "--", targetPath], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    return true;
  } catch (error) {
    const code = (error as { status?: number }).status;
    if (code === 1) return false;
    throw error;
  }
}

describe(".gitignore — project-local artifact tree", () => {
  it("ignores nested .omniharness local state directories", () => {
    const probes = [
      path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "config.json"),
      path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "cli-home", "codex", "home", "config.toml"),
      path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "credential-profiles", "claude", "env"),
      path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "memory", "decisions.md"),
      path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "agent-runtime-output", "worker.jsonl"),
    ];

    try {
      for (const probe of probes) {
        mkdirSync(path.dirname(probe), { recursive: true });
        writeFileSync(probe, "");
        expect(gitCheckIgnore(probe)).toBe(true);
      }
    } finally {
      rmSync(path.join(REPO_ROOT, "tmp-gitignore-probe"), { recursive: true, force: true });
    }
  });

  it("ignores **/.omniharness/run-data/<runId>/* (nested case)", () => {
    // Use a path under a tmp directory inside the repo so git can
    // check it. We can't run `git check-ignore` on a path outside the
    // working tree, so we create the synthetic path under the repo's
    // .gitignored area and clean up after.
    const sandbox = mkdtempSync(path.join(tmpdir(), "gitignore-test-"));
    try {
      const target = path.join(sandbox, "project", ".omniharness", "run-data", "fake-run", "execution-events.jsonl");
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, "");
      // Check via a synthetic in-repo path: copy the structure under
      // the repo tree where the .gitignore applies.
      const repoLocal = path.join(REPO_ROOT, "tmp-gitignore-probe", "project", ".omniharness", "run-data", "fake-run", "execution-events.jsonl");
      mkdirSync(path.dirname(repoLocal), { recursive: true });
      writeFileSync(repoLocal, "");
      try {
        expect(gitCheckIgnore(repoLocal)).toBe(true);
      } finally {
        rmSync(path.join(REPO_ROOT, "tmp-gitignore-probe"), { recursive: true, force: true });
      }
    } finally {
      if (existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("ignores top-level run-data/ (legacy global path inside a repo, if any)", () => {
    const probe = path.join(REPO_ROOT, "run-data", "probe-file");
    mkdirSync(path.dirname(probe), { recursive: true });
    writeFileSync(probe, "");
    try {
      expect(gitCheckIgnore(probe)).toBe(true);
    } finally {
      rmSync(path.join(REPO_ROOT, "run-data"), { recursive: true, force: true });
    }
  });
});
