"use client";

import type { ChatAttachment, PendingChatAttachment } from "@/lib/chat-attachments";
import type { RuntimeAPIs } from "@/runtime-api/types";

/**
 * Upload pending composer attachments and return their persisted descriptors.
 * Shared by the conversation-send and queued-message mutation hooks.
 */
export async function uploadPendingChatAttachments(
  attachments: PendingChatAttachment[],
  filesApi: Pick<RuntimeAPIs["files"], "upload">,
): Promise<ChatAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const formData = new FormData();
  attachments.forEach((attachment) => formData.append("files", attachment.file, attachment.name));
  const response = await filesApi.upload(formData) as {
    ok: true;
    attachments: ChatAttachment[];
  };

  return response.attachments;
}
