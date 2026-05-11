import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { notificationSubscriptions } from "@/server/db/schema";
import { listActiveNotificationSubscriptions } from "@/server/notifications/preferences";
import { sendWebPushNotification, type WebPushPayload } from "@/server/notifications/web-push";

function shouldRevokeDeliveryFailure(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode = "statusCode" in error ? Number((error as { statusCode?: unknown }).statusCode) : 0;
  return statusCode === 404 || statusCode === 410;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function deliverNotificationToSubscriptions(payload: WebPushPayload) {
  const subscriptions = await listActiveNotificationSubscriptions();
  let delivered = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await sendWebPushNotification({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      }, payload);
      delivered += 1;
      await db.update(notificationSubscriptions)
        .set({
          failureCount: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(notificationSubscriptions.id, subscription.id));
    } catch (error) {
      failed += 1;
      await db.update(notificationSubscriptions)
        .set({
          failureCount: subscription.failureCount + 1,
          lastError: errorMessage(error),
          revokedAt: shouldRevokeDeliveryFailure(error) ? new Date() : subscription.revokedAt,
          updatedAt: new Date(),
        })
        .where(eq(notificationSubscriptions.id, subscription.id));
    }
  }

  return {
    attempted: subscriptions.length,
    delivered,
    failed,
  };
}
