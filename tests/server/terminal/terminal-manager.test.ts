import { afterEach, describe, expect, it } from "vitest";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import { getTerminalManager, type TerminalChunk } from "@/server/terminal/terminal-manager";

const manager = getTerminalManager();
const createdIds: string[] = [];

function open() {
  const created = manager.createTerminal({ cwd: os.tmpdir(), cols: 80, rows: 24 });
  createdIds.push(created.id);
  return created;
}

/**
 * Collect output until `predicate` is satisfied or the timeout elapses.
 * `subscribe` replays buffered chunks synchronously, so the callback can fire
 * before `subscribe` returns — track settlement separately from the handle.
 */
function waitForOutput(id: string, predicate: (acc: string) => boolean, timeoutMs = 4000) {
  return new Promise<string>((resolve, reject) => {
    let acc = "";
    let settled = false;
    let unsubscribe: (() => void) | null = null;
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      unsubscribe?.();
      run();
    };

    unsubscribe = manager.subscribe(id, 0, {
      onChunk: (chunk: TerminalChunk) => {
        acc += chunk.data;
        if (predicate(acc)) {
          finish(() => resolve(acc));
        }
      },
      onExit: () => {
        finish(() => reject(new Error(`terminal exited early; captured: ${JSON.stringify(acc)}`)));
      },
    });

    if (!unsubscribe) {
      reject(new Error("subscribe returned null"));
      return;
    }
    // Output may have already satisfied the predicate during synchronous replay.
    if (settled) {
      unsubscribe();
      return;
    }
    const timer = setTimeout(() => {
      finish(() => reject(new Error(`timeout waiting for output; captured: ${JSON.stringify(acc)}`)));
    }, timeoutMs);
    timer.unref?.();
  });
}

afterEach(() => {
  for (const id of createdIds.splice(0)) {
    manager.kill(id);
  }
});

describe("TerminalManager", () => {
  it("creates random session-bound managed terminals and enforces their owner", () => {
    const created = manager.createManagedTerminal({
      command: process.platform === "win32" ? "cmd.exe" : "/bin/sh",
      args: [],
      env: { PATH: process.env.PATH ?? "", HOME: os.tmpdir(), TERM: "xterm-256color" },
      cwd: os.tmpdir(),
      ownerSessionId: "session-a",
      runnerInstanceId: "runner-a",
      accountId: "account-a",
      operationId: "operation-a",
    });
    createdIds.push(created.id);

    expect(created.id).toMatch(/^term-[0-9a-f-]{36}$/);
    expect(manager.authorize(created.id, {
      sessionId: "session-a",
      runnerInstanceId: "runner-a",
      scope: "account_auth",
      accountId: "account-a",
      operationId: "operation-a",
    })).toBe(true);
    expect(manager.authorize(created.id, {
      sessionId: "session-b",
      runnerInstanceId: "runner-a",
      scope: "account_auth",
      accountId: "account-a",
      operationId: "operation-a",
    })).toBe(false);
  });

  it("spawns a pty and round-trips stdin to streamed output", async () => {
    const { id } = open();
    expect(manager.has(id)).toBe(true);
    manager.write(id, "echo OMNI_MARKER_123\r");
    const out = await waitForOutput(id, (acc) => acc.includes("OMNI_MARKER_123"));
    expect(out).toContain("OMNI_MARKER_123");
  });

  it("starts a responsive shell without waiting for interactive startup files", async () => {
    if (process.platform === "win32") return;

    const fixtureRoot = mkdtempSync(join(os.tmpdir(), "omni-terminal-shell-"));
    const shell = join(fixtureRoot, "zsh");
    writeFileSync(shell, [
      "#!/bin/sh",
      "if [ \"$1\" != \"-f\" ]; then sleep 10; fi",
      "exec /bin/sh",
      "",
    ].join("\n"));
    chmodSync(shell, 0o755);
    const originalShell = process.env.SHELL;
    process.env.SHELL = shell;

    try {
      const { id } = open();
      manager.write(id, "printf 'OMNI_%s\\n' FAST_SHELL\r");
      const out = await waitForOutput(id, (acc) => acc.includes("OMNI_FAST_SHELL"));
      expect(out).toContain("OMNI_FAST_SHELL");
    } finally {
      if (originalShell === undefined) delete process.env.SHELL;
      else process.env.SHELL = originalShell;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("adds managed user bin directories when shell startup files are disabled", async () => {
    if (process.platform === "win32") return;

    const fixtureRoot = mkdtempSync(join(os.tmpdir(), "omni-terminal-path-"));
    const localBin = join(fixtureRoot, ".local", "bin");
    const command = join(localBin, "omni-path-probe");
    const shell = join(fixtureRoot, "zsh");
    mkdirSync(localBin, { recursive: true });
    writeFileSync(command, "#!/bin/sh\nprintf 'OMNI_PATH_READY\\n'\n");
    chmodSync(command, 0o755);
    writeFileSync(shell, "#!/bin/sh\nexec /bin/sh\n");
    chmodSync(shell, 0o755);

    const originalHome = process.env.HOME;
    const originalPath = process.env.PATH;
    const originalShell = process.env.SHELL;
    process.env.HOME = fixtureRoot;
    process.env.PATH = "/usr/bin:/bin";
    process.env.SHELL = shell;

    try {
      const { id } = open();
      manager.write(id, "omni-path-probe\r");
      const out = await waitForOutput(id, (acc) => (
        acc.includes("OMNI_PATH_READY") || acc.includes("not found")
      ));
      expect(out).toContain("OMNI_PATH_READY");
      expect(out).not.toContain("not found");
    } finally {
      if (originalHome === undefined) delete process.env.HOME;
      else process.env.HOME = originalHome;
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalShell === undefined) delete process.env.SHELL;
      else process.env.SHELL = originalShell;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("replays buffered output to a late subscriber from a given seq", async () => {
    const { id } = open();
    manager.write(id, "echo REPLAY_ME\r");
    await waitForOutput(id, (acc) => acc.includes("REPLAY_ME"));

    // A brand-new subscriber starting at seq 0 should still see the earlier output.
    const replayed = await waitForOutput(id, (acc) => acc.includes("REPLAY_ME"));
    expect(replayed).toContain("REPLAY_ME");
  });

  it("resize and write return false for unknown terminals", () => {
    expect(manager.write("term-does-not-exist", "x")).toBe(false);
    expect(manager.resize("term-does-not-exist", 100, 40)).toBe(false);
    expect(manager.kill("term-does-not-exist")).toBe(false);
  });

  it("resizes a live terminal without throwing", async () => {
    const { id } = open();
    expect(manager.resize(id, 120, 40)).toBe(true);
    // The shell should still be responsive after a resize.
    manager.write(id, "echo AFTER_RESIZE\r");
    const out = await waitForOutput(id, (acc) => acc.includes("AFTER_RESIZE"));
    expect(out).toContain("AFTER_RESIZE");
  });

  it("kill removes the terminal", () => {
    const { id } = open();
    expect(manager.has(id)).toBe(true);
    expect(manager.kill(id)).toBe(true);
    expect(manager.has(id)).toBe(false);
  });

  it("notifies subscribers when the pty exits", async () => {
    const { id } = open();
    const exit = await new Promise<{ exitCode: number }>((resolve, reject) => {
      const unsubscribe = manager.subscribe(id, 0, {
        onChunk: () => {},
        onExit: (info) => {
          unsubscribe?.();
          resolve(info);
        },
      });
      if (!unsubscribe) {
        reject(new Error("subscribe returned null"));
        return;
      }
      manager.write(id, "exit\r");
      setTimeout(() => {
        unsubscribe();
        reject(new Error("timeout waiting for exit"));
      }, 4000);
    });
    expect(typeof exit.exitCode).toBe("number");
  });
});
