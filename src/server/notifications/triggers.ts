import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { deliverNotificationToSubscriptions } from "@/server/notifications/deliver";
import type { WebPushPayload } from "@/server/notifications/web-push";
import { t } from "@/lib/i18n-core";

type RunLifecycleEvent = {
  runId: string;
  eventType: string;
  details?: Record<string, unknown>;
};

function titleForRun(run: typeof runs.$inferSelect) {
  return run.title?.trim() || "Conversation";
}

function runUrl(runId: string) {
  return `/session/${encodeURIComponent(runId)}`;
}

function notificationForEvent(run: typeof runs.$inferSelect, event: RunLifecycleEvent): WebPushPayload | null {
  if (event.eventType === "run_completed") {
    return {
      title: t("notifications.push.conversationComplete"),
      body: t("notifications.push.conversationCompleteBody", { title: titleForRun(run) }),
      tag: `omniharness-${run.id}-complete`,
      url: runUrl(run.id),
    };
  }

  if (
    event.eventType === "clarification_requested"
    || event.eventType === "clarifications_requested"
    || event.eventType === "preflight_confirmation_required"
  ) {
    return {
      title: t("notifications.push.needsInput"),
      body: t("notifications.push.needsInputBody", { title: titleForRun(run) }),
      tag: `omniharness-${run.id}-input`,
      url: runUrl(run.id),
    };
  }

  if (event.eventType === "worker_permission_requested") {
    return {
      title: t("notifications.push.needsInput"),
      body: t("notifications.push.permissionBody", { title: titleForRun(run) }),
      tag: `omniharness-${run.id}-permission`,
      url: runUrl(run.id),
    };
  }

  return null;
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
