import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueuedConversationMessageRecord } from "@/app/home/types";

export function QueuedMessageDrawer({
  messages,
  cancellingMessageIds,
  themeMode,
  onEdit,
  onCancel,
}: {
  messages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
  themeMode: "day" | "night";
  onEdit: (message: QueuedConversationMessageRecord) => void;
  onCancel: (messageId: string) => void;
}) {
  const visibleMessages = messages.filter((message) => message.status === "pending" || message.status === "delivering");
  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mx-auto -mb-2 w-[calc(100%-2rem)] max-w-[44rem] overflow-hidden rounded-t-2xl border px-2.5 pb-3 pt-2 shadow-[0_18px_48px_-30px_rgba(24,24,27,0.34)]",
        themeMode === "night"
          ? "border-border/50 bg-muted/80 dark:bg-[#282828]"
          : "border-[#dededb] bg-[#f3f3f0]",
      )}
    >
      <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
        Queued messages
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {visibleMessages.map((message) => {
          const isCancelling = cancellingMessageIds.has(message.id);
          return (
            <div
              key={message.id}
              className={cn(
                "flex min-h-8 items-center gap-1.5 rounded-md border px-2 py-1.5",
                themeMode === "night"
                  ? "border-border/40 bg-background/35"
                  : "border-[#e3e3df] bg-[#fbfbf8]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] leading-4 text-foreground">
                  {message.content || `${message.attachments?.length ?? 0} attachment${message.attachments?.length === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isCancelling || message.status === "delivering"}
                  onClick={() => onEdit(message)}
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Edit queued message"
                  title="Edit queued message"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isCancelling || message.status === "delivering"}
                  onClick={() => onCancel(message.id)}
                  className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground"
                  aria-label="Cancel queued message"
                  title="Cancel queued message"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
