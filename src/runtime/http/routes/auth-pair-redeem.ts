import { getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { insertAuthEvent } from "@/server/auth/audit";
import { redeemPairingToken } from "@/server/auth/pairing";
import { errorResponse } from "@/server/api-errors";
import { parseOpaqueTokenValue } from "@/server/auth/session";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { setSessionCookie } from "./cookies";

export const handleAuthPairRedeemRequest: OmniHttpHandler = async (request) => {
  let pairToken = "";
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    if (!isAuthEnabled()) {
      return errorResponse("Authentication must be enabled before pairing devices.", {
        status: 400,
        source: "Auth",
        action: "Redeem pairing token",
      });
    }

    const configurationError = getAuthConfigurationError();
    if (configurationError) {
      return errorResponse(configurationError, {
        status: 503,
        source: "Auth",
        action: "Redeem pairing token",
      });
    }

    const body = await request.json().catch(() => ({}));
    pairToken = typeof body?.pairToken === "string" ? body.pairToken.trim() : "";
    if (!pairToken) {
      return errorResponse("Pair token is required.", {
        status: 400,
        source: "Auth",
        action: "Redeem pairing token",
      });
    }

    const pairing = await redeemPairingToken({
      pairToken,
      userAgent: toNextRequest(request).headers.get("user-agent"),
    });

    await insertAuthEvent({
      eventType: "auth.pairing_redeemed",
      sessionId: pairing.sessionId,
      pairTokenId: pairing.pairingId,
      details: {
        targetRunId: pairing.targetRunId,
        deviceLabel: pairing.deviceLabel,
      },
    });

    const response = Response.json({
      ok: true,
      targetPath: pairing.targetRunId ? `/session/${pairing.targetRunId}` : "/",
      sessionId: pairing.sessionId,
      pairingId: pairing.pairingId,
    });
    setSessionCookie(response, pairing.tokenValue, pairing.expiresAt);
    return response;
  } catch (error) {
    const parsedToken = parseOpaqueTokenValue(pairToken);
    await insertAuthEvent({
      eventType: "auth.pairing_rejected",
      pairTokenId: parsedToken?.id ?? null,
      details: {
        message: error instanceof Error ? error.message : String(error),
      },
    }).catch(() => undefined);

    const message = error instanceof Error ? error.message : String(error);
    const status = /expired|already been used|invalid|malformed|not found|revoked/i.test(message) ? 400 : 500;
    return errorResponse(error, {
      status,
      source: "Auth",
      action: "Redeem pairing token",
    });
  }
};
