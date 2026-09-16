import { parseChatAttachmentsJson } from "@/lib/chat-attachments";

type SerializableMessageRecord = {
  id: string;
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
  workerId?: string | null;
  attachmentsJson?: string | null;
  operationFingerprint?: string | null;
  deliveryOptionsJson?: string | null;
  createdAt: Date;
};

export function serializeMessageRecord(message: SerializableMessageRecord | null | undefined) {
  if (!message) {
    return message;
  }

  const {
    operationFingerprint: _operationFingerprint,
    deliveryOptionsJson: _deliveryOptionsJson,
    ...publicMessage
  } = message;
  return {
    ...publicMessage,
    createdAt: message.createdAt.toISOString(),
    attachments: parseChatAttachmentsJson(message.attachmentsJson),
  };
}
