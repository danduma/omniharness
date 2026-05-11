import { randomUUID } from "crypto";
import { eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { notificationSubscriptions } from "@/server/db/schema";

export type BrowserPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function parseBrowserPushSubscription(value: unknown): BrowserPushSubscription | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };
  const endpoint = typeof candidate.endpoint === "string" ? candidate.endpoint.trim() : "";
  const p256dh = typeof candidate.keys?.p256dh === "string" ? candidate.keys.p256dh.trim() : "";
  const auth = typeof candidate.keys?.auth === "string" ? candidate.keys.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: null,
    keys: { p256dh, auth },
  };
}

export async function saveNotificationSubscription(args: {
  subscription: BrowserPushSubscription;
  sessionId?: string | null;
  userAgent?: string | null;
}) {
  const now = new Date();
  await db.insert(notificationSubscriptions)
    .values({
      id: randomUUID(),
      endpoint: args.subscription.endpoint,
      p256dh: args.subscription.keys.p256dh,
      auth: args.subscription.keys.auth,
      sessionId: args.sessionId ?? null,
      userAgent: args.userAgent?.trim() || null,
      failureCount: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      revokedAt: null,
    })
    .onConflictDoUpdate({
      target: notificationSubscriptions.endpoint,
      set: {
        p256dh: args.subscription.keys.p256dh,
        auth: args.subscription.keys.auth,
        sessionId: args.sessionId ?? null,
        userAgent: args.userAgent?.trim() || null,
        failureCount: 0,
        lastError: null,
        updatedAt: now,
        lastSeenAt: now,
        revokedAt: null,
      },
    });
}

export async function revokeNotificationSubscription(endpoint: string) {
  const normalizedEndpoint = endpoint.trim();
  if (!normalizedEndpoint) {
    return;
  }

  const now = new Date();
  await db.update(notificationSubscriptions)
    .set({ revokedAt: now, updatedAt: now })
    .where(eq(notificationSubscriptions.endpoint, normalizedEndpoint));
}

export async function listActiveNotificationSubscriptions() {
  return db
    .select()
    .from(notificationSubscriptions)
    .where(isNull(notificationSubscriptions.revokedAt));
}
