import { describe, expect, test } from "vitest";
import { PairDeviceStateManager } from "@/components/component-state-managers";

describe("PairDeviceStateManager", () => {
  test("ignores stale pairing updates after a different code becomes current", () => {
    const manager = new PairDeviceStateManager();

    manager.patch({
      pairing: { pairingId: "pair-a", pairUrl: "https://example.test/a", expiresAt: "2026-05-20T00:00:00.000Z" },
      pairingStatus: "pending",
      isActivating: false,
      error: null,
    });

    manager.patch({
      pairing: { pairingId: "pair-b", pairUrl: "https://example.test/b", expiresAt: "2026-05-20T00:00:00.000Z" },
      pairingStatus: "pending",
      isActivating: false,
      error: null,
    });

    manager.patchIfCurrentPairing("pair-a", {
      pairingStatus: "redeemed",
      error: "stale failure",
    });

    expect(manager.getSnapshot()).toMatchObject({
      pairing: expect.objectContaining({ pairingId: "pair-b" }),
      pairingStatus: "pending",
      error: null,
    });
  });

  test("applies updates for the active pairing", () => {
    const manager = new PairDeviceStateManager();

    manager.patch({
      pairing: { pairingId: "pair-a", pairUrl: "https://example.test/a", expiresAt: "2026-05-20T00:00:00.000Z" },
      pairingStatus: "pending",
      isActivating: false,
      error: null,
    });

    manager.patchIfCurrentPairing("pair-a", {
      pairingStatus: "redeemed",
    });

    expect(manager.getSnapshot().pairingStatus).toBe("redeemed");
  });
});
