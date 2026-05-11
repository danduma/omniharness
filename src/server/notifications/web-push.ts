import webPush from "web-push";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

const VAPID_PUBLIC_KEY_SETTING = "__NOTIFICATIONS_VAPID_PUBLIC_KEY";
const VAPID_PRIVATE_KEY_SETTING = "__NOTIFICATIONS_VAPID_PRIVATE_KEY";
const VAPID_SUBJECT = "mailto:notifications@omniharness.local";

export type WebPushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

export type StoredWebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export async function getVapidKeys() {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, VAPID_PUBLIC_KEY_SETTING));
  const publicKey = rows[0]?.value?.trim() ?? "";
  const privateRow = await db
    .select()
    .from(settings)
    .where(eq(settings.key, VAPID_PRIVATE_KEY_SETTING))
    .get();
  const privateKey = privateRow?.value?.trim() ?? "";

  if (publicKey && privateKey) {
    return { publicKey, privateKey };
  }

  const generated = webPush.generateVAPIDKeys();
  const now = new Date();
  await db.insert(settings)
    .values({ key: VAPID_PUBLIC_KEY_SETTING, value: generated.publicKey, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: generated.publicKey, updatedAt: now },
    });
  await db.insert(settings)
    .values({ key: VAPID_PRIVATE_KEY_SETTING, value: generated.privateKey, updatedAt: now })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: generated.privateKey, updatedAt: now },
    });

  return generated;
}

export async function getVapidPublicKey() {
  return (await getVapidKeys()).publicKey;
}

export async function sendWebPushNotification(
  subscription: StoredWebPushSubscription,
  payload: WebPushPayload,
) {
  const keys = await getVapidKeys();
  webPush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  return webPush.sendNotification(subscription, JSON.stringify(payload));
}
