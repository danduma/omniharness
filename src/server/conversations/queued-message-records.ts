import { normalizeChatAttachments } from "@/lib/chat-attachments";
import type { queuedConversationMessages } from "@/server/db/schema";

export type BusyMessageAction = "queue" | "steer";
export type QueuedConversationMessageStatus = "pending" | "delivering" | "delivered" | "cancelled" | "failed";

type QueuedConversationMessageRecord = typeof queuedConversationMessages.$inferSelect;

export function serializeQueuedConversationMessage(record: QueuedConversationMessageRecord) {
  return {
    id: record.id,
    runId: record.runId,
    targetWorkerId: record.targetWorkerId,
    action: record.action as BusyMessageAction,
    content: record.content,
    status: record.status as QueuedConversationMessageStatus,
    lastError: record.lastError,
    attachments: normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
  };
}
