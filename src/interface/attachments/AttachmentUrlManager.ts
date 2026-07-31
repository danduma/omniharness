"use client";

import { useEffect, useMemo } from "react";
import type { ChatAttachment } from "@/lib/chat-attachments";
import { StateManager } from "@/lib/state-manager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { useRuntimeAPIs } from "@/runtime-api/provider";

type AttachmentUrlState = {
  urlsByKey: Record<string, string | undefined>;
};

function attachmentKey(attachment: ChatAttachment) {
  return attachment.storagePath
    ? `${attachment.storagePath}\u0000${attachment.mimeType}`
    : null;
}

class AttachmentUrlManager extends StateManager<AttachmentUrlState> {
  private readonly references = new Map<string, number>();
  private readonly pending = new Map<string, Promise<void>>();

  constructor() {
    super({ urlsByKey: {} });
  }

  acquire(
    attachment: ChatAttachment,
    load: (input: { path: string; mimeType?: string }) => Promise<Blob>,
  ) {
    const key = attachmentKey(attachment);
    if (!key || !attachment.storagePath) {
      return;
    }
    this.references.set(key, (this.references.get(key) ?? 0) + 1);
    if (this.getSnapshot().urlsByKey[key] || this.pending.has(key)) {
      return;
    }

    const request = load({
      path: attachment.storagePath,
      mimeType: attachment.mimeType,
    }).then((blob) => {
      if (!this.references.has(key)) {
        return;
      }
      const url = URL.createObjectURL(blob);
      this.patch((current) => ({
        urlsByKey: { ...current.urlsByKey, [key]: url },
      }));
    }).finally(() => {
      this.pending.delete(key);
    });
    this.pending.set(key, request);
  }

  release(attachment: ChatAttachment) {
    const key = attachmentKey(attachment);
    if (!key) {
      return;
    }
    const remaining = (this.references.get(key) ?? 1) - 1;
    if (remaining > 0) {
      this.references.set(key, remaining);
      return;
    }
    this.references.delete(key);
    const url = this.getSnapshot().urlsByKey[key];
    if (url) {
      URL.revokeObjectURL(url);
      this.patch((current) => {
        const urlsByKey = { ...current.urlsByKey };
        delete urlsByKey[key];
        return { urlsByKey };
      });
    }
  }

  resolve(attachment: ChatAttachment, urlsByKey: AttachmentUrlState["urlsByKey"]) {
    return attachment.previewUrl || (attachmentKey(attachment)
      ? urlsByKey[attachmentKey(attachment) as string] ?? ""
      : "");
  }
}

const attachmentUrlManager = new AttachmentUrlManager();

export function useAttachmentUrls(attachments: ChatAttachment[]) {
  const runtimeApis = useRuntimeAPIs();
  const { urlsByKey } = useManagerSnapshot(attachmentUrlManager);
  const signature = attachments
    .map((attachment) => `${attachment.id}\u0000${attachmentKey(attachment) ?? ""}`)
    .join("\u0001");
  const trackedAttachments = useMemo(() => attachments, [signature]);

  useEffect(() => {
    for (const attachment of trackedAttachments) {
      attachmentUrlManager.acquire(attachment, runtimeApis.files.attachment);
    }
    return () => {
      for (const attachment of trackedAttachments) {
        attachmentUrlManager.release(attachment);
      }
    };
  }, [runtimeApis.files.attachment, trackedAttachments]);

  return (attachment: ChatAttachment) => attachmentUrlManager.resolve(attachment, urlsByKey);
}
