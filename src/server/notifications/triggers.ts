import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { clarifications, runs } from "@/server/db/schema";
import { deliverNotificationToSubscriptions } from "@/server/notifications/deliver";
import type { WebPushPayload } from "@/server/notifications/web-push";
import { t } from "@/lib/i18n-core";
import { emitNamedEvent } from "@/server/events/named-events";
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
  if (event.eventType === "run_completed") {
    // Delivery can race a follow-up; an old completion must never announce
    // success for a conversation that has already resumed.
    if (run.status !== "done" && run.status !== "completed") {
      emitNamedEvent({ kind: "notification.suppressed", runId: run.id, reason: "run_not_completed", eventType: event.eventType });
      return null;
    }
    kind = "complete";
    tag = "complete";
  } else if (["clarification_requested", "clarifications_requested", "preflight_confirmation_required", "implementation_confirmation_requested", "worker_elicitation_requested"].includes(event.eventType)) {
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

  let notificationEvent = event;
  if (["clarification_requested", "clarifications_requested", "preflight_confirmation_required", "implementation_confirmation_requested"].includes(event.eventType)) {
    const question = await db.select({ question: clarifications.question }).from(clarifications)
      .where(and(eq(clarifications.runId, run.id), eq(clarifications.status, "pending")))
      .orderBy(asc(clarifications.createdAt)).get();
    if (question) notificationEvent = { ...event, details: { ...event.details, question: question.question } };
  }
  const payload = notificationForEvent(run, notificationEvent);
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
