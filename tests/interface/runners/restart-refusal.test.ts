import { describe, expect, it } from "vitest";
import { createFetchRuntimeRequest } from "@/runtime-api/request";
import { isRestartRefusal } from "@/interface/runners/RunnerControls";

async function rejectionFrom(fetchImpl: typeof fetch) {
  return createFetchRuntimeRequest({ fetchImpl, surface: "web" })("POST", "/api/runner/restart")
    .then(() => null, (error: unknown) => error);
}

describe("isRestartRefusal", () => {
  it("surfaces a refusal the restart route stated itself", async () => {
    const refusal = await rejectionFrom(async () => new Response(
      JSON.stringify({
        error: {
          code: "runner.restart.control_unavailable",
          message: "No restart control service is listening on port 3099.",
        },
      }),
      { status: 503 },
    ));

    expect(isRestartRefusal(refusal)).toBe(true);
  });

  it("surfaces an auth rejection that stopped the request before the control service", async () => {
    const rejected = await rejectionFrom(async () => new Response(
      JSON.stringify({ error: { message: "Authentication required." } }),
      { status: 403 },
    ));

    expect(isRestartRefusal(rejected)).toBe(true);
  });

  it("treats a dying or returning server as a restart in progress", async () => {
    // The connection cut before any reply.
    expect(isRestartRefusal(await rejectionFrom(async () => {
      throw new TypeError("Failed to fetch");
    }))).toBe(false);

    // A bare gateway status from whatever still answers on the port. The old
    // rule surfaced this as "The server operation failed" on restarts that
    // had in fact worked.
    expect(isRestartRefusal(await rejectionFrom(async () => new Response("", { status: 502 })))).toBe(false);
    expect(isRestartRefusal(await rejectionFrom(async () => new Response("", { status: 503 })))).toBe(false);

    // The booting server redirecting into its app shell.
    expect(isRestartRefusal(await rejectionFrom(async () => new Response("", {
      status: 302,
      headers: { location: "/" },
    })))).toBe(false);
  });

  it("treats missing and malformed rejections as a restart in progress", () => {
    expect(isRestartRefusal(undefined)).toBe(false);
    expect(isRestartRefusal(null)).toBe(false);
    expect(isRestartRefusal(new Error("boom"))).toBe(false);
    expect(isRestartRefusal({ code: 503 })).toBe(false);
  });
});
