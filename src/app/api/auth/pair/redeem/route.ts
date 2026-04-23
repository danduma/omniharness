import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE, isAuthEnabled } from "@/server/auth/config";
import { insertAuthEvent } from "@/server/auth/audit";
import { redeemPairingToken } from "@/server/auth/pairing";
import { errorResponse } from "@/server/api-errors";
import { parseOpaqueTokenValue } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  let pairToken = "";
  try {
    if (!isAuthEnabled()) {
      return errorResponse("Authentication must be enabled before pairing devices.", {
        status: 400,
        source: "Auth",
        action: "Redeem pairing token",
      });
    }

    const body = await req.json().catch(() => ({}));
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
      userAgent: req.headers.get("user-agent"),
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

    const response = NextResponse.json({
      ok: true,
      targetPath: pairing.targetRunId ? `/session/${pairing.targetRunId}` : "/",
      sessionId: pairing.sessionId,
      pairingId: pairing.pairingId,
    });
    response.cookies.set(AUTH_SESSION_COOKIE, pairing.tokenValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: pairing.expiresAt,
    });
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
}
