import { NextRequest, NextResponse } from "next/server";
import { getPublicOriginFromUrl, isAuthEnabled } from "@/server/auth/config";
import { createPairingToken, getPairingRecord } from "@/server/auth/pairing";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";

export async function POST(req: NextRequest) {
  try {
    if (!isAuthEnabled()) {
      return errorResponse("Authentication must be enabled before pairing devices.", {
        status: 400,
        source: "Auth",
        action: "Create pairing QR",
      });
    }

    const auth = await requireApiSession(req, {
      source: "Auth",
      action: "Create pairing QR",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json().catch(() => ({}));
    const targetRunId = typeof body?.targetRunId === "string" && body.targetRunId.trim()
      ? body.targetRunId.trim()
      : null;
    const deviceLabel = typeof body?.deviceLabel === "string" && body.deviceLabel.trim()
      ? body.deviceLabel.trim()
      : null;
    const publicOrigin = getPublicOriginFromUrl(req.url);
    const targetPath = targetRunId ? `/session/${targetRunId}` : "/";
    const pairing = await createPairingToken({
      creatorSessionId: auth.session!.id,
      targetRunId,
      deviceLabel,
    });

    await insertAuthEvent({
      eventType: "auth.pairing_created",
      sessionId: auth.session!.id,
      pairTokenId: pairing.pairingId,
      details: {
        targetRunId,
        deviceLabel,
      },
    });

    return NextResponse.json({
      pairingId: pairing.pairingId,
      expiresAt: pairing.expiresAt,
      pairUrl: `${publicOrigin}${targetPath}${targetPath.includes("?") ? "&" : "?"}pair=${encodeURIComponent(pairing.pairToken)}`,
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Create pairing QR",
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Auth",
      action: "Load pairing status",
    });
    if (auth.response) {
      return auth.response;
    }

    const pairingId = req.nextUrl.searchParams.get("id")?.trim();
    if (!pairingId) {
      return errorResponse("Pairing id is required.", {
        status: 400,
        source: "Auth",
        action: "Load pairing status",
      });
    }

    const pairing = await getPairingRecord(pairingId);
    if (!pairing) {
      return errorResponse("Pairing token not found.", {
        status: 404,
        source: "Auth",
        action: "Load pairing status",
      });
    }

    const now = Date.now();
    const expired = new Date(pairing.expiresAt).getTime() <= now;
    return NextResponse.json({
      pairing: {
        id: pairing.id,
        expiresAt: pairing.expiresAt,
        redeemedAt: pairing.redeemedAt,
        expired,
        status: pairing.redeemedAt
          ? "redeemed"
          : pairing.revokedAt
            ? "revoked"
            : expired
              ? "expired"
              : "pending",
      },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Load pairing status",
    });
  }
}
