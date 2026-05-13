import Image from "next/image";
import type React from "react";
import { Copy } from "lucide-react";
import { attachmentImagePreviewManager } from "@/components/component-state-managers";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

export type UserInputMessageAction = {
  label: string;
  title?: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
};

interface UserInputMessageProps {
  content: string;
  attachments?: ChatAttachment[];
  createdAt?: string;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onCopy?: (content: string) => void | Promise<void>;
  actions?: UserInputMessageAction[];
}

function formatUserMessageTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function UserInputMessage({
  content,
  attachments = [],
  createdAt,
  isExpanded,
  onToggleExpanded,
  onCopy,
  actions = [],
}: UserInputMessageProps) {
  const isLongMessage = content.length > 420 || content.split(/\r\n|\r|\n/).length > 6;
  const timestampLabel = createdAt ? formatUserMessageTimestamp(createdAt) : "";
  const attachmentUrl = (attachment: ChatAttachment) => attachment.previewUrl
    || (attachment.storagePath
      ? `/api/attachments?path=${encodeURIComponent(attachment.storagePath)}&mimeType=${encodeURIComponent(attachment.mimeType)}`
      : "");

  return (
    <div className="flex justify-end">
      <div className="flex w-full max-w-[min(68ch,calc(100%-1rem))] flex-col items-end sm:max-w-[min(74ch,calc(100%-1.5rem))]">
        <div className="omni-user-message group/user-message relative w-full overflow-hidden rounded-2xl px-5 py-3.5 text-left text-sm leading-6 transition-colors">
          {content ? (
            <span
              className="block select-text overflow-hidden whitespace-pre-wrap break-words"
              style={{ maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)" }}
            >
              {content}
            </span>
          ) : null}
          {attachments.length > 0 ? (
            <div className={cn("flex flex-wrap gap-2", content && "mt-3")}>
              {attachments.map((attachment) => {
                const url = attachmentUrl(attachment);
                return attachment.kind === "image" && url ? (
                  <button
                    type="button"
                    key={attachment.id}
                    onClick={() => attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })}
                    className="group/attachment inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl bg-muted/60 p-1.5 pr-3 text-xs"
                    title={`Preview ${attachment.name}`}
                    aria-label={`Preview ${attachment.name}`}
                  >
                    <Image
                      src={url}
                      alt={attachment.name}
                      width={72}
                      height={72}
                      unoptimized
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
                    className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-xs"
                  >
                    <span className="truncate">{attachment.name}</span>
                    <span className="shrink-0 opacity-60">{formatBytes(attachment.size)}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          {isExpanded || isLongMessage ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Show less message text" : "Show more message text"}
              onClick={onToggleExpanded}
              className={cn(
                "omni-user-message-expand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
                isExpanded
                  ? "mt-1 block w-full text-right text-[11px] font-semibold leading-5"
                  : "omni-user-message-expand--collapsed absolute inset-x-0 bottom-0 flex justify-end px-5 pb-3.5 pt-5 text-[11px] font-semibold leading-5 transition-colors",
              )}
            >
              {isExpanded ? "less" : "...more"}
            </button>
          ) : null}
        </div>
        {timestampLabel || onCopy || actions.length > 0 ? (
          <div className="mt-1.5 flex w-full items-center justify-end gap-2 pr-4 text-[13px] leading-none text-[#8a8b8e] dark:text-zinc-500">
            {timestampLabel ? <span>{timestampLabel}</span> : null}
            {onCopy ? (
              <button
                type="button"
                aria-label={t("conversation.message.copyAria")}
                title="Copy message"
                onClick={() => void onCopy(content)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="h-4 w-4" />
              </button>
            ) : null}
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                aria-label={action.label}
                title={action.title ?? action.label}
                disabled={action.disabled}
                onClick={action.onClick}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
              >
                {action.icon}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
