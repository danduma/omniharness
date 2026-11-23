import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { deliverNotificationToSubscriptions } from "@/server/notifications/deliver";
import type { WebPushPayload } from "@/server/notifications/web-push";
import { t } from "@/lib/i18n-core";
import { conversationNotificationContent, notificationEventDetail, type ConversationNotificationKind } from "@/lib/conversation-notification-content";

type RunLifecycleEvent = {
  runId: string;
  eventType: string;
  details?: Record<string, unknown>;
};

function titleForRun(run: typeof runs.$inferSelect) {
  return run.title?.trim() || t("notifications.push.fallbackConversationTitle");
}

function runUrl(runId: string) {
  return `/session/${encodeURIComponent(runId)}`;
}

function notificationForEvent(run: typeof runs.$inferSelect, event: RunLifecycleEvent): WebPushPayload | null {
  let kind: ConversationNotificationKind;
  let tag: string;
  if (event.eventType === "worker_elicitation_requested") {
    kind = "input";
    tag = "input";
  } else if (event.eventType === "worker_permission_requested") {
    kind = "permission";
    tag = "permission";
  } else {
    return null;
  }
  return {
    ...conversationNotificationContent({ kind, title: titleForRun(run), detail: notificationEventDetail(event.details) }, t),
    tag: `omniharness-${run.id}-${tag}`,
    url: runUrl(run.id),
  };
}

export async function notifyRunLifecycleEvent(event: RunLifecycleEvent) {
  const run = await db.select().from(runs).where(eq(runs.id, event.runId)).get();
  if (!run) {
    return null;
  }

  const payload = notificationForEvent(run, event);
  if (!payload) {
    return null;
  }

  return deliverNotificationToSubscriptions(payload);
}

export async function notifyRunLifecycleEventBestEffort(event: RunLifecycleEvent) {
  try {
    await notifyRunLifecycleEvent(event);
  } catch (error) {
    console.warn("Failed to deliver run notification", error);
  }
}
