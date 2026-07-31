"use client";

import { attachmentImagePreviewManager } from "@/components/component-state-managers";
import { useAttachmentUrls } from "@/interface/attachments/AttachmentUrlManager";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";

export function UserMessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  const attachmentUrl = useAttachmentUrls(attachments);
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const url = attachmentUrl(attachment);
        return attachment.kind === "image" && url ? (
          <button
            type="button"
            key={attachment.id}
            onClick={() => attachmentImagePreviewManager.open({
              url,
              name: attachment.name,
              size: attachment.size,
            })}
            className="group/attachment inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-[#e9e9e9] p-1.5 pr-3 text-xs dark:border-white/10 dark:bg-black/15"
            title={`Preview ${attachment.name}`}
            aria-label={`Preview ${attachment.name}`}
          >
            <img
              src={url}
              alt={attachment.name}
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-lg object-cover transition-transform group-hover/attachment:scale-105"
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{attachment.name}</span>
              <span className="opacity-60">{formatBytes(attachment.size)}</span>
            </span>
          </button>
        ) : (
          <div
            key={attachment.id}
            className="inline-flex max-w-full items-center gap-2 rounded-full border border-border/60 bg-[#e9e9e9] px-3 py-1.5 text-xs dark:border-white/10 dark:bg-black/15"
          >
            <span className="truncate">{attachment.name}</span>
            <span className="shrink-0 opacity-60">{formatBytes(attachment.size)}</span>
          </div>
        );
      })}
    </div>
  );
}
