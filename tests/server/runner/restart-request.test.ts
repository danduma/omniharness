import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { requestRunnerRestart } from "@/server/runner/restart-request";

function repoWithToken(token: string | null) {
  const root = mkdtempSync(path.join(tmpdir(), "omni-restart-"));
  if (token !== null) {
    mkdirSync(path.join(root, ".omniharness"), { recursive: true });
    writeFileSync(path.join(root, ".omniharness", "remote-restart-token"), `${token}\n`, { mode: 0o600 });
  }
  return root;
}

describe("requestRunnerRestart", () => {
  it("forwards the on-disk token to the restart control service", async () => {
    // The browser cannot call the control server itself: different origin, and
    // the token is a 0600 file. The runner proxies with the token attached.
    const repoRoot = repoWithToken("secret-token");
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, pid: 4321, mode: "prod", startedAt: 1785745922471 }), { status: 200 }),
    );

    const outcome = await requestRunnerRestart({ repoRoot, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(outcome).toEqual({ ok: true, pid: 4321, mode: "prod", startedAt: 1785745922471 });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain("/restart-current");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer secret-token" });
  });

  it("reports a clear reason when the control service is not running", async () => {
    // Restart control is a separate process. If it is down, the runner cannot
    // restart itself, and the user needs to be told that rather than shown a
    // generic failure.
    const repoRoot = repoWithToken("secret-token");
    const fetchImpl = vi.fn().mockRejectedValue(Object.assign(new Error("fetch failed"), { code: "ECONNREFUSED" }));

    const outcome = await requestRunnerRestart({ repoRoot, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ code: "control_unavailable" });
    expect((outcome as { message: string }).message).toContain("restart:control");
  });

  it("reports a missing token instead of calling the control service", async () => {
    const repoRoot = repoWithToken(null);
    const fetchImpl = vi.fn();

    const outcome = await requestRunnerRestart({ repoRoot, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(outcome).toMatchObject({ ok: false, code: "control_unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("distinguishes a rejected token from an unreachable service", async () => {
    const repoRoot = repoWithToken("stale-token");
    const fetchImpl = vi.fn().mockResolvedValue(new Response("no", { status: 401 }));

    const outcome = await requestRunnerRestart({ repoRoot, env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(outcome).toMatchObject({ ok: false, code: "control_unauthorized" });
  });
});
