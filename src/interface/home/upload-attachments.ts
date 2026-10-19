"use client";

import { compressImageAttachment } from "@/interface/attachments/compress-image-attachment";
import type { ChatAttachment, PendingChatAttachment } from "@/lib/chat-attachments";
import type { RuntimeAPIs } from "@/runtime-api/types";

async function prepareUploadFile(attachment: PendingChatAttachment) {
  if (attachment.kind !== "image") {
    return { file: attachment.file, name: attachment.name };
  }
  const compressed = await compressImageAttachment(attachment.file, attachment.name);
  return { file: compressed, name: compressed === attachment.file ? attachment.name : compressed.name };
}

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

  const uploads = await Promise.all(attachments.map(prepareUploadFile));
  const formData = new FormData();
  uploads.forEach(({ file, name }) => formData.append("files", file, name));
  const response = await filesApi.upload(formData) as {
    ok: true;
    attachments: ChatAttachment[];
  };

  return response.attachments;
}
