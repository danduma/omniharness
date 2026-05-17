import { afterEach, describe, expect, it, vi } from "vitest";

describe("codex-auth imports", () => {
  afterEach(() => {
    vi.doUnmock("node:fs");
    vi.doUnmock("proper-lockfile");
    vi.resetModules();
  });

  it("does not load the locking dependency for sync credential reads", async () => {
    const existsSync = vi.fn(() => false);
    const readFileSync = vi.fn();

    vi.doMock("node:fs", () => ({
      default: {
        existsSync,
        readFileSync,
      },
    }));
    vi.doMock("proper-lockfile", () => {
      throw new Error("proper-lockfile should only load while refreshing credentials");
    });

    const { readCodexCredentialsSync } = await import("../../../src/server/supervisor/codex-auth");

    expect(readCodexCredentialsSync()).toBeNull();
    expect(existsSync).toHaveBeenCalled();
    expect(readFileSync).not.toHaveBeenCalled();
  });
});
