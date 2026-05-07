import Image from "next/image";
import type React from "react";
import { Copy } from "lucide-react";
import { formatBytes, type ChatAttachment } from "@/lib/chat-attachments";
import { cn } from "@/lib/utils";

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

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
    <div className="flex justify-start pl-4 sm:pl-6">
      <div className="flex w-full max-w-[min(72ch,calc(100%-1rem))] flex-col items-start sm:max-w-[min(78ch,calc(100%-1.5rem))]">
        <div className="group/user-message relative w-full overflow-hidden rounded-[1.55rem] bg-[#f3f3f3] px-6 py-4 text-left text-sm leading-6 text-[#202124] transition-colors hover:bg-[#eeeeee] dark:bg-[#3a3a3a] dark:text-[#d8d8d8] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] dark:hover:bg-[#404040]">
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
                  <a
                    key={attachment.id}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="group/attachment inline-flex max-w-full items-center gap-2 overflow-hidden rounded-xl border border-border/60 bg-[#e9e9e9] p-1.5 pr-3 text-xs dark:border-white/10 dark:bg-black/15"
                    title={`Open ${attachment.name}`}
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
                  </a>
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
          ) : null}
          {isExpanded || isLongMessage ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Show less message text" : "Show more message text"}
              onClick={onToggleExpanded}
              className={cn(
                "text-[#606164] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 dark:text-[#d8d8d8] dark:focus-visible:ring-white/45",
                isExpanded
                  ? "mt-1 block w-full text-right text-[11px] font-semibold leading-5"
                  : "absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#f3f3f3] via-[#f3f3f3]/95 to-transparent px-6 pb-4 pt-6 text-[11px] font-semibold leading-5 transition-colors group-hover/user-message:from-[#eeeeee] group-hover/user-message:via-[#eeeeee]/95 dark:from-[#3a3a3a] dark:via-[#3a3a3a]/95 dark:group-hover/user-message:from-[#404040] dark:group-hover/user-message:via-[#404040]/95",
              )}
            >
              {isExpanded ? "less" : "...more"}
            </button>
          ) : null}
        </div>
        {timestampLabel || onCopy || actions.length > 0 ? (
          <div className="mt-1.5 flex w-full items-center justify-end gap-2 pr-5 text-[13px] leading-none text-[#8a8b8e] dark:text-zinc-500">
            {timestampLabel ? <span>{timestampLabel}</span> : null}
            {onCopy ? (
              <button
                type="button"
                aria-label="Copy message"
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
