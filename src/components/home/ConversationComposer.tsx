import type React from "react";
import { ArrowUp, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposerSelect } from "@/components/composer/ComposerSelect";
import { ConversationModePicker, type ConversationModeOption } from "@/components/ConversationModePicker";
import { EFFORT_OPTIONS } from "@/app/home/constants";
import type { ComposerWorkerOption, WorkerModelOption } from "@/app/home/types";
import type { AttachmentItem } from "@/components/FileAttachmentPickerDialog";
import { cn } from "@/lib/utils";

interface ConversationComposerProps {
  className: string;
  command: string;
  setCommand: (value: string) => void;
  setCommandCursor: (value: number) => void;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSubmit: (event: React.FormEvent) => void;
  selectedRunId: string | null;
  selectedConversationMode: ConversationModeOption;
  setSelectedConversationMode: (value: ConversationModeOption) => void;
  showMentionPicker: boolean;
  currentProjectScope: string | null;
  filteredProjectFiles: string[];
  mentionIndex: number;
  setMentionIndex: React.Dispatch<React.SetStateAction<number>>;
  applyMention: (filePath: string) => void;
  themeMode: "day" | "night";
  attachments: AttachmentItem[];
  handleRemoveAttachment: (attachmentPath: string) => void;
  setShowAttachmentPicker: (open: boolean) => void;
  shouldLockDirectWorker: boolean;
  lockedDirectWorkerLabel: string;
  selectedCliAgent: ComposerWorkerOption;
  setSelectedCliAgent: (value: ComposerWorkerOption) => void;
  composerWorkerOptions: Array<{ value: ComposerWorkerOption; label: string }>;
  selectedModel: string;
  setSelectedModel: (value: string) => void;
  activeWorkerModelOptions: WorkerModelOption[];
  selectedEffort: string;
  setSelectedEffort: (value: string) => void;
  isComposerSubmitting: boolean;
  isPlanningConversation: boolean;
  isDirectConversation: boolean;
  onSendConversationMessage: (content: string) => void;
  onRunCommand: (content: string) => void;
}

export function ConversationComposer({
  className,
  command,
  setCommand,
  setCommandCursor,
  commandInputRef,
  handleSubmit,
  selectedRunId,
  selectedConversationMode,
  setSelectedConversationMode,
  showMentionPicker,
  currentProjectScope,
  filteredProjectFiles,
  mentionIndex,
  setMentionIndex,
  applyMention,
  themeMode,
  attachments,
  handleRemoveAttachment,
  setShowAttachmentPicker,
  shouldLockDirectWorker,
  lockedDirectWorkerLabel,
  selectedCliAgent,
  setSelectedCliAgent,
  composerWorkerOptions,
  selectedModel,
  setSelectedModel,
  activeWorkerModelOptions,
  selectedEffort,
  setSelectedEffort,
  isComposerSubmitting,
  isPlanningConversation,
  isDirectConversation,
  onSendConversationMessage,
  onRunCommand,
}: ConversationComposerProps) {
  return (
  <div className={`relative z-20 w-full shrink-0 bg-background p-3 sm:p-4 ${className}`}>
    <form onSubmit={handleSubmit} className="group relative mx-auto max-w-3xl">
      {!selectedRunId ? (
        <ConversationModePicker
          value={selectedConversationMode}
          onChange={setSelectedConversationMode}
        />
      ) : null}
      {showMentionPicker && (
        <div className="absolute inset-x-0 bottom-full mb-3 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
          <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
            {currentProjectScope}
          </div>
          <div className="max-h-72 overflow-y-auto p-2">
            {filteredProjectFiles.length > 0 ? (
              filteredProjectFiles.map((filePath, index) => (
                <button
                  key={filePath}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyMention(filePath)}
                  className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    index === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="truncate">{filePath}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No matching files in this project.
              </div>
            )}
          </div>
        </div>
      )}
      <div
        className={cn(
          "rounded-[1.5rem] px-4 pb-0.5 pt-3 transition-all sm:px-5 sm:pb-1 sm:pt-4",
          themeMode === "night"
            ? "border border-transparent bg-muted/80 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)] focus-within:bg-muted/90 dark:bg-[#2f2f2f] dark:focus-within:bg-[#343434]"
            : "border border-[#d8d8d8] bg-[#fbfbfa] shadow-[0_24px_60px_-34px_rgba(24,24,27,0.22),0_1px_0_rgba(255,255,255,0.92)_inset] focus-within:bg-white",
        )}
      >
        <textarea
          ref={commandInputRef}
          value={command}
          onChange={(e) => {
            setCommand(e.target.value);
            setCommandCursor(e.target.selectionStart ?? e.target.value.length);
          }}
          onClick={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyUp={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (showMentionPicker) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((current) => (current + 1) % Math.max(filteredProjectFiles.length, 1));
                return;
              }

              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((current) =>
                  current === 0 ? Math.max(filteredProjectFiles.length - 1, 0) : current - 1
                );
                return;
              }

              if ((e.key === "Enter" || e.key === "Tab") && filteredProjectFiles[mentionIndex]) {
                e.preventDefault();
                applyMention(filteredProjectFiles[mentionIndex]);
                return;
              }

              if (e.key === "Escape") {
                e.preventDefault();
                setCommandCursor(0);
                return;
              }
            }

            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!isComposerSubmitting && command.trim()) {
                if (selectedRunId && (isPlanningConversation || isDirectConversation)) {
                  onSendConversationMessage(command);
                } else {
                  onRunCommand(command);
                }
              }
            }
          }}
          placeholder="Ask Omni anything. @ to refer to files"
          disabled={isComposerSubmitting}
          rows={1}
          className={cn(
            "min-h-[56px] w-full resize-none bg-transparent text-[15px] leading-6 outline-none",
            themeMode === "night"
              ? "text-foreground placeholder:text-muted-foreground/80"
              : "text-[#454545] placeholder:text-[#c4c4c2]",
          )}
        />

        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.path}
                className={cn(
                  "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-sm",
                  themeMode === "night"
                    ? "bg-background/65 text-foreground dark:bg-black/20"
                    : "border border-[#e2e2df] bg-white/95 text-[#4d4d4d]",
                )}
              >
                <span className="truncate">{attachment.relativePath}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.path)}
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                    themeMode === "night"
                      ? "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      : "text-[#8f8f8f] hover:bg-black/5 hover:text-[#5c5c5c]",
                  )}
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            {!selectedRunId ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowAttachmentPicker(true)}
                className={cn(
                  "h-10 w-10 rounded-full",
                  themeMode === "night"
                    ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
                    : "text-[#959595] hover:bg-black/[0.04] hover:text-[#666666]",
                )}
                aria-label="Attach files"
              >
                <Plus className="h-5 w-5" />
              </Button>
            ) : null}
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {shouldLockDirectWorker ? (
              <div className={cn(
                "rounded-full border px-3 py-2 text-xs font-semibold",
                themeMode === "night"
                  ? "border-border/60 bg-background/50 text-muted-foreground"
                  : "border-[#d8d8d8] bg-white/90 text-[#6a6a6a]",
              )}>
                Direct worker: {lockedDirectWorkerLabel}
              </div>
            ) : (
              <ComposerSelect
                ariaLabel="CLI harness"
                value={selectedCliAgent}
                options={composerWorkerOptions}
                onChange={setSelectedCliAgent}
                themeMode={themeMode}
              />
            )}

            <ComposerSelect
              ariaLabel="Worker model"
              value={selectedModel}
              options={activeWorkerModelOptions}
              onChange={setSelectedModel}
              themeMode={themeMode}
            />

            <ComposerSelect
              ariaLabel="Worker effort"
              value={selectedEffort}
              options={EFFORT_OPTIONS.map((effort) => ({ value: effort, label: effort }))}
              onChange={setSelectedEffort}
              themeMode={themeMode}
            />

            <Button
              type="submit"
              size="icon"
              disabled={isComposerSubmitting || !command.trim()}
              className={cn(
                "h-10 w-10 rounded-full transition-all",
                themeMode === "night"
                  ? "bg-foreground text-background hover:bg-foreground/90 disabled:bg-foreground/50"
                  : "bg-[#9d9d9d] text-white hover:bg-[#8b8b8b] disabled:bg-[#c9c9c9]",
              )}
            >
              {isComposerSubmitting ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  </div>
  );
}
