import { afterEach, describe, expect, it } from "vitest";
import os from "node:os";
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
  it("spawns a pty and round-trips stdin to streamed output", async () => {
    const { id } = open();
    expect(manager.has(id)).toBe(true);
    manager.write(id, "echo OMNI_MARKER_123\r");
    const out = await waitForOutput(id, (acc) => acc.includes("OMNI_MARKER_123"));
    expect(out).toContain("OMNI_MARKER_123");
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
