import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHomeMutations } from "@/interface/home/useHomeMutations";
import { homeUiStateManager } from "@/interface/home/HomeUiStateManager";
import { createFetchRuntimeRequest } from "@/runtime-api/request";

// Expose the real mutation callbacks without mounting the entire home screen.
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...await importOriginal<typeof import("@tanstack/react-query")>(),
  useMutation: (options: unknown) => options,
}));
vi.mock("@/runtime-api/provider", () => ({ useRuntimeAPIs: () => ({}) }));

describe("home authentication failures", () => {
  beforeEach(() => {
    homeUiStateManager.patch(() => ({ authError: null, pairRedeemError: null }));
  });

  it.each([
    ["loginMutation", "authError", 401, "Incorrect password."],
    ["loginMutation", "authError", 403, "Cross-site request rejected."],
    ["redeemPairMutation", "pairRedeemError", 400, "Pairing token expired."],
  ] as const)("preserves %s %s errors (HTTP %s)", async (mutation, field, status, message) => {
    const request = createFetchRuntimeRequest({
      surface: "web",
      fetchImpl: async () => Response.json({ error: { message } }, { status }),
    });
    const error = await request("POST", "/api/auth/login").catch((failure: unknown) => failure);
    const mutations = useHomeMutations({} as Parameters<typeof useHomeMutations>[0]);
    const callback = mutations[mutation] as unknown as { onError(error: unknown): void };
    callback.onError(error);
    expect(homeUiStateManager.getSnapshot()[field]).toBe(message);
  });
});
