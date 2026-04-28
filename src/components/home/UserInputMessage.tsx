import type React from "react";
import { Copy } from "lucide-react";
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
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onCopy?: (content: string) => void | Promise<void>;
  actions?: UserInputMessageAction[];
}

export function UserInputMessage({
  content,
  isExpanded,
  onToggleExpanded,
  onCopy,
  actions = [],
}: UserInputMessageProps) {
  const isLongMessage = content.length > 420 || content.split(/\r\n|\r|\n/).length > 6;

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[min(72ch,88%)] flex-col items-end sm:max-w-[min(78ch,82%)]">
        <div className="group/user-message relative w-full overflow-hidden rounded-[1.9rem] rounded-br-lg bg-[#242424] px-4 py-2.5 text-left text-sm leading-6 text-white shadow-sm transition-colors hover:bg-[#2d2d2d]">
          <span
            className="block select-text overflow-hidden whitespace-pre-wrap break-words"
            style={{ maxHeight: isExpanded ? undefined : "calc(1.5rem * 6)" }}
          >
            {content}
          </span>
          {isExpanded || isLongMessage ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Show less message text" : "Show more message text"}
              onClick={onToggleExpanded}
              className={cn(
                "text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70",
                isExpanded
                  ? "mt-1 block w-full text-right text-[11px] font-semibold leading-5"
                  : "absolute inset-x-0 bottom-0 flex justify-end bg-gradient-to-t from-[#242424] via-[#242424]/95 to-transparent px-4 pb-2.5 pt-6 text-[11px] font-semibold leading-5 transition-colors group-hover/user-message:from-[#2d2d2d] group-hover/user-message:via-[#2d2d2d]/95",
              )}
            >
              {isExpanded ? "less" : "...more"}
            </button>
          ) : null}
        </div>
        {onCopy || actions.length > 0 ? (
          <div className="mt-1 flex items-center gap-1 pr-2 text-muted-foreground/70">
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
