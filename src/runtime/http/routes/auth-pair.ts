import { getAuthConfigurationError, getPublicOriginFromRequest, isAuthEnabled } from "@/server/auth/config";
import { createPairingToken, getPairingRecord } from "@/server/auth/pairing";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

async function postAuthPair(request: Request) {
  const nextRequest = toNextRequest(request);
  if (!isAuthEnabled()) {
    return errorResponse("Authentication must be enabled before pairing devices.", {
      status: 400,
      source: "Auth",
      action: "Create pairing QR",
    });
  }

  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return errorResponse(configurationError, {
      status: 503,
      source: "Auth",
      action: "Create pairing QR",
    });
  }

  const auth = await requireApiSession(nextRequest, {
    source: "Auth",
    action: "Create pairing QR",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const targetRunId = typeof body?.targetRunId === "string" && body.targetRunId.trim()
    ? body.targetRunId.trim()
    : null;
  const deviceLabel = typeof body?.deviceLabel === "string" && body.deviceLabel.trim()
    ? body.deviceLabel.trim()
    : null;
  const pairToken = typeof body?.pairToken === "string" && body.pairToken.trim()
    ? body.pairToken.trim()
    : null;
  const publicOrigin = getPublicOriginFromRequest(nextRequest.url, nextRequest.headers);
  const targetPath = targetRunId ? `/session/${targetRunId}` : "/";
  const pairing = await createPairingToken({
    creatorSessionId: auth.session!.id,
    targetRunId,
    deviceLabel,
    pairToken,
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

  return Response.json({
    pairingId: pairing.pairingId,
    expiresAt: pairing.expiresAt,
    pairUrl: `${publicOrigin}${targetPath}${targetPath.includes("?") ? "&" : "?"}pair=${encodeURIComponent(pairing.pairToken)}`,
  });
}

async function getAuthPair(request: Request) {
  const nextRequest = toNextRequest(request);
  const auth = await requireApiSession(nextRequest, {
    source: "Auth",
    action: "Load pairing status",
  });
  if (auth.response) {
    return auth.response;
  }

  const pairingId = new URL(request.url).searchParams.get("id")?.trim();
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
  return Response.json({
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
}

export const handleAuthPairRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "POST") {
      return postAuthPair(request);
    }
    if (request.method === "GET") {
      return getAuthPair(request);
    }
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, POST" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: request.method === "GET" ? "Load pairing status" : "Create pairing QR",
    });
  }
};
