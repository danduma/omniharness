import { describe, expect, it, vi } from "vitest";
import {
  parseRunnerAdminArgs,
  runRunnerRekeyCommand,
} from "@/server/cli/admin-commands";

describe("runner administration CLI", () => {
  it("parses an identity-confirmed rekey without accepting a positional token", () => {
    expect(parseRunnerAdminArgs([
      "--runner", "https://runner.example.test",
      "--token-stdin",
      "--confirm-identity", "runner-old",
    ])).toEqual({
      runnerUrl: "https://runner.example.test",
      tokenFile: null,
      tokenStdin: true,
      legacyToken: null,
      confirmRunnerInstanceId: "runner-old",
    });
  });

  it("rekeys through the authenticated runner API and redacts the token from output", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      runner: { runnerInstanceId: "runner-new", name: "Studio" },
      previousRunnerInstanceId: "runner-old",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const result = await runRunnerRekeyCommand([
      "--runner", "https://runner.example.test",
      "--token-stdin",
      "--confirm-identity", "runner-old",
    ], {
      fetchImpl: fetchMock,
      readStdin: async () => "private-token\n",
      env: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("https://runner.example.test/api/runner/rekey"),
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: "Bearer private-token",
        }),
        body: JSON.stringify({ confirmRunnerInstanceId: "runner-old" }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
});
