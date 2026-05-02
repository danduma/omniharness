import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QueuedConversationMessageRecord } from "@/app/home/types";

export function QueuedMessageDrawer({
  messages,
  cancellingMessageIds,
  themeMode,
  onCancel,
}: {
  messages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
  themeMode: "day" | "night";
  onCancel: (messageId: string) => void;
}) {
  const visibleMessages = messages.filter((message) => message.status === "pending" || message.status === "delivering");
  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mx-auto -mb-2 w-[calc(100%-2rem)] max-w-[44rem] overflow-hidden rounded-t-2xl border px-3 pb-4 pt-3 shadow-[0_18px_48px_-30px_rgba(24,24,27,0.34)]",
        themeMode === "night"
          ? "border-border/50 bg-muted/80 dark:bg-[#282828]"
          : "border-[#dededb] bg-[#f3f3f0]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-muted-foreground">
          Queued messages
        </div>
        <div className="text-[11px] text-muted-foreground">
          {visibleMessages.length}
        </div>
      </div>
      <div className="max-h-36 space-y-1.5 overflow-y-auto">
        {visibleMessages.map((message) => {
          const isCancelling = cancellingMessageIds.has(message.id);
          return (
            <div
              key={message.id}
              className={cn(
                "flex min-h-10 items-start gap-2 rounded-lg border px-2.5 py-2",
                themeMode === "night"
                  ? "border-border/40 bg-background/35"
                  : "border-[#e3e3df] bg-[#fbfbf8]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm leading-5 text-foreground">
                  {message.content || `${message.attachments?.length ?? 0} attachment${message.attachments?.length === 1 ? "" : "s"}`}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {message.action === "steer" ? "Steer deferred" : "Queued"}{message.status === "delivering" ? " · delivering" : ""}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isCancelling || message.status === "delivering"}
                onClick={() => onCancel(message.id)}
                className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                aria-label="Cancel queued message"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
