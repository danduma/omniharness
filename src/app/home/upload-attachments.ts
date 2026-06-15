"use client";

import type { ChatAttachment, PendingChatAttachment } from "@/lib/chat-attachments";
import { requestJson } from "@/lib/app-errors";

/**
 * Upload pending composer attachments and return their persisted descriptors.
 * Shared by the conversation-send and queued-message mutation hooks.
 */
export async function uploadPendingChatAttachments(attachments: PendingChatAttachment[]): Promise<ChatAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const formData = new FormData();
  attachments.forEach((attachment) => formData.append("files", attachment.file, attachment.name));
  const response = await requestJson<{ ok: true; attachments: ChatAttachment[] }>("/api/attachments", {
    method: "POST",
    body: formData,
  }, {
    source: "Attachments",
    action: "Upload attachments",
  });

  return response.attachments;
}
