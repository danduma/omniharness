import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authPairTokens, authSessions } from "@/server/db/schema";
import { createPairingToken, redeemPairingToken } from "@/server/auth/pairing";
import { createAuthSession, getSessionFromTokenValue } from "@/server/auth/session";

describe("auth pairing tokens", () => {
  beforeEach(async () => {
    await db.delete(authEvents);
    await db.delete(authPairTokens);
    await db.delete(authSessions);
  });

  it("redeems a one-time pairing token into a durable mobile session", async () => {
    const creator = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });

    const pairing = await createPairingToken({
      creatorSessionId: creator.sessionId,
      targetRunId: "run-123",
      deviceLabel: "My phone",
    });

    const redeemed = await redeemPairingToken({
      pairToken: pairing.pairToken,
      userAgent: "Mobile Safari",
    });

    expect(redeemed.targetRunId).toBe("run-123");
    expect(redeemed.deviceLabel).toBe("My phone");

    const loadedSession = await getSessionFromTokenValue(redeemed.tokenValue, { touch: false });
    expect(loadedSession).toEqual(expect.objectContaining({
      id: redeemed.sessionId,
      label: "My phone",
      authMethod: "qr_pair",
    }));
  });

  it("rejects replaying an already redeemed pairing token", async () => {
    const creator = await createAuthSession({
      label: "Desktop",
      userAgent: "Desktop browser",
      authMethod: "password_login",
    });

    const pairing = await createPairingToken({
      creatorSessionId: creator.sessionId,
      deviceLabel: "Replay phone",
    });

    await redeemPairingToken({
      pairToken: pairing.pairToken,
      userAgent: "Phone",
    });

    await expect(redeemPairingToken({
      pairToken: pairing.pairToken,
      userAgent: "Phone",
    })).rejects.toThrow(/already been used/i);
  });
});
