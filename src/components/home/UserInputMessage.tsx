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
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onCopy?: (content: string) => void | Promise<void>;
  actions?: UserInputMessageAction[];
}

export function UserInputMessage({
  content,
  attachments = [],
  isExpanded,
  onToggleExpanded,
  onCopy,
  actions = [],
}: UserInputMessageProps) {
  const isLongMessage = content.length > 420 || content.split(/\r\n|\r|\n/).length > 6;
  const attachmentUrl = (attachment: ChatAttachment) => attachment.previewUrl
    || (attachment.storagePath
      ? `/api/attachments?path=${encodeURIComponent(attachment.storagePath)}&mimeType=${encodeURIComponent(attachment.mimeType)}`
      : "");

  return (
    <div className="flex justify-start pl-4 sm:pl-6">
      <div className="flex w-full max-w-[min(72ch,calc(100%-1rem))] flex-col items-start sm:max-w-[min(78ch,calc(100%-1.5rem))]">
        <div className="group/user-message relative w-full overflow-hidden rounded-lg bg-[#3a3a3a] px-3 py-2 text-left text-sm leading-6 text-[#d8d8d8] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:bg-[#404040]">
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
                    className="group/attachment overflow-hidden rounded-xl border border-white/10 bg-black/15"
                    title={attachment.name}
                  >
                    <img
                      src={url}
                      alt={attachment.name}
                      className="h-24 w-24 object-cover transition-transform group-hover/attachment:scale-105"
                    />
                  </a>
                ) : (
                  <div
                    key={attachment.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-xs"
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
                "text-[#d8d8d8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45",
                isExpanded
                  ? "mt-1 block w-full text-right text-[11px] font-semibold leading-5"
                  : "absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#3a3a3a] via-[#3a3a3a]/95 to-transparent px-3 pb-2 pt-6 text-[11px] font-semibold leading-5 transition-colors group-hover/user-message:from-[#404040] group-hover/user-message:via-[#404040]/95",
              )}
            >
              {isExpanded ? "less" : "...more"}
            </button>
          ) : null}
        </div>
        {onCopy || actions.length > 0 ? (
          <div className="mt-1 flex items-center gap-1 pl-1 text-muted-foreground/70">
            {onCopy ? (
              <button
                type="button"
                aria-label="Copy message"
                title="Copy message"
                onClick={() => void onCopy(content)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Copy className="h-3.5 w-3.5" />
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
