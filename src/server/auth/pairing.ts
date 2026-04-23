import crypto from "crypto";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { authPairTokens } from "@/server/db/schema";
import { AUTH_PAIR_TOKEN_TTL_MS, getAuthKey } from "@/server/auth/config";
import { createAuthSession, parseOpaqueTokenValue } from "@/server/auth/session";

function hashPairSecret(secret: string) {
  return crypto.createHmac("sha256", getAuthKey()).update(secret).digest("base64url");
}

function createPairSecret() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createPairingToken(args: {
  creatorSessionId: string;
  targetRunId?: string | null;
  deviceLabel?: string | null;
}) {
  const id = randomUUID();
  const secret = createPairSecret();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + AUTH_PAIR_TOKEN_TTL_MS);

  await db.insert(authPairTokens).values({
    id,
    tokenHash: hashPairSecret(secret),
    creatorSessionId: args.creatorSessionId,
    targetRunId: args.targetRunId ?? null,
    deviceLabel: args.deviceLabel?.trim() || null,
    expiresAt,
    redeemedAt: null,
    redeemedSessionId: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return {
    pairToken: `${id}.${secret}`,
    pairingId: id,
    expiresAt,
  };
}

export async function getPairingRecord(pairingId: string) {
  return db.select().from(authPairTokens).where(eq(authPairTokens.id, pairingId)).get();
}

export async function redeemPairingToken(args: {
  pairToken: string;
  userAgent?: string | null;
}) {
  const parsed = parseOpaqueTokenValue(args.pairToken);
  if (!parsed) {
    throw new Error("Malformed pairing token.");
  }

  const record = await getPairingRecord(parsed.id);
  if (!record) {
    throw new Error("Pairing token not found.");
  }

  if (record.revokedAt) {
    throw new Error("Pairing token has been revoked.");
  }

  if (record.redeemedAt) {
    throw new Error("Pairing token has already been used.");
  }

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    throw new Error("Pairing token has expired.");
  }

  if (!crypto.timingSafeEqual(
    Buffer.from(record.tokenHash, "utf8"),
    Buffer.from(hashPairSecret(parsed.secret), "utf8"),
  )) {
    throw new Error("Pairing token is invalid.");
  }

  const session = await createAuthSession({
    label: record.deviceLabel || "Paired mobile device",
    userAgent: args.userAgent ?? null,
    authMethod: "qr_pair",
    createdBySessionId: record.creatorSessionId,
  });

  const redeemedAt = new Date();
  await db.update(authPairTokens).set({
    redeemedAt,
    redeemedSessionId: session.sessionId,
    updatedAt: redeemedAt,
  }).where(eq(authPairTokens.id, record.id));

  return {
    ...session,
    pairingId: record.id,
    targetRunId: record.targetRunId,
    deviceLabel: record.deviceLabel,
  };
}
