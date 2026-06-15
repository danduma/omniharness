import Image from "next/image";
import { useRef } from "react";
import type React from "react";
import { ArrowUp, FileText, LoaderCircle, Plus, SlidersHorizontal, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComposerModelPicker } from "@/components/composer/ComposerModelPicker";
import { ComposerSelect } from "@/components/composer/ComposerSelect";
import { ConversationModePicker, type ConversationModeOption } from "@/components/ConversationModePicker";
import type { ComposerMode } from "@/app/home/types";
import { QueuedMessageDrawer } from "./QueuedMessageDrawer";
import { BranchWorkspaceButton } from "./BranchWorkspaceButton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EFFORT_OPTIONS } from "@/app/home/constants";
import { isManualStopCommand, resolveBusyMessageActionForSubmitAction, type BusyComposerBehavior, type BusyMessageAction } from "@/app/home/busy-message-behavior";
import { getComposerSubmitShortcutLabel, isAppleComposerShortcutPlatform, shouldInterruptQueuedMessageKeyDown, shouldSubmitComposerKeyDown, shouldUseAlternateComposerSubmitKeyDown } from "@/app/home/composer-keyboard";
import type { ComposerWorkerOption, QueuedConversationMessageRecord, WorkerModelOption } from "@/app/home/types";
import { formatBytes, type PendingChatAttachment } from "@/lib/chat-attachments";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { StateManager } from "@/lib/state-manager";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { cn } from "@/lib/utils";

interface ConversationComposerProps {
  className: string;
  command: string;
  setCommandCursor: (value: number) => void;
  setComposerDraft: (patch: { command?: string; commandCursor?: number }) => void;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  handleSubmit: (event: React.FormEvent) => void;
  selectedRunId: string | null;
  selectedConversationMode: ComposerMode;
  setSelectedConversationMode: (value: ConversationModeOption) => void;
  showMentionPicker: boolean;
  currentProjectScope: string | null;
  workspaceProjectPath: string | null;
  filteredProjectFiles: string[];
  mentionIndex: number;
  setMentionIndex: React.Dispatch<React.SetStateAction<number>>;
  applyMention: (filePath: string) => void;
  onOpenProjectFile?: (filePath: string) => void;
  themeMode: "day" | "night";
  attachments: PendingChatAttachment[];
  handleRemoveAttachment: (attachmentId: string) => void;
  onAddAttachmentFiles: (files: File[]) => void;
  onAddPastedImages: (files: File[]) => void;
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
  isStopConversationPending: boolean;
  isConversationStoppable: boolean;
  composerBehavior: BusyComposerBehavior;
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingQueuedMessageIds: Set<string>;
  interruptingQueuedMessageIds: Set<string>;
  onEditQueuedMessage: (message: QueuedConversationMessageRecord) => void;
  onInterruptQueuedMessage: (messageId: string) => void;
  onCancelQueuedMessage: (messageId: string) => void;
  onInterruptComposer: () => void;
  onSendConversationMessage: (content: string, busyAction?: BusyMessageAction) => void;
  onRunCommand: (content: string) => void;
  onStopConversation: () => void;
}

class ComposerUiManager extends StateManager<{ mobileSettingsOpen: boolean }> {
  constructor() {
    super({ mobileSettingsOpen: false });
  }

  setMobileSettingsOpen = (mobileSettingsOpen: boolean) => this.setKey("mobileSettingsOpen", mobileSettingsOpen);
}

const composerUiManager = new ComposerUiManager();

export function ConversationComposer({
  className,
  command,
  setCommandCursor,
  setComposerDraft,
  commandInputRef,
  handleSubmit,
  selectedRunId,
  selectedConversationMode,
  setSelectedConversationMode,
  showMentionPicker,
  currentProjectScope,
  workspaceProjectPath,
  filteredProjectFiles,
  mentionIndex,
  setMentionIndex,
  applyMention,
  onOpenProjectFile,
  themeMode,
  attachments,
  handleRemoveAttachment,
  onAddAttachmentFiles,
  onAddPastedImages,
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
  isStopConversationPending,
  isConversationStoppable,
  composerBehavior,
  queuedMessages,
  cancellingQueuedMessageIds,
  interruptingQueuedMessageIds,
  onEditQueuedMessage,
  onInterruptQueuedMessage,
  onCancelQueuedMessage,
  onInterruptComposer,
  onSendConversationMessage,
  onRunCommand,
  onStopConversation,
}: ConversationComposerProps) {
  useI18nSnapshot();
  const trimmedCommand = command.trim();
  const hasAttachments = attachments.length > 0;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { mobileSettingsOpen } = useManagerSnapshot(composerUiManager);
  const isStopButtonVisible = composerBehavior.buttonKind === "stop";
  const showSeparateStopButton = isConversationStoppable && !isStopButtonVisible;
  const isSendButtonBusy = isComposerSubmitting && !isStopButtonVisible;
  const isStopButtonBusy = isStopButtonVisible && isStopConversationPending;
  const isSubmitButtonDisabled = isStopButtonVisible
    ? isStopConversationPending
    : isComposerSubmitting || (!trimmedCommand && !hasAttachments);
  const alternateSubmitShortcutLabel = getComposerSubmitShortcutLabel(isAppleComposerShortcutPlatform());
  const sendButtonAriaLabel = t(composerBehavior.ariaLabelKey);
  const sendButtonTitle = composerBehavior.submitAction === "send_queue"
    ? t("conversation.composer.sendButton.queueTitle", { shortcut: alternateSubmitShortcutLabel })
    : composerBehavior.submitAction === "send_steer" && composerBehavior.allowAlternateBusyAction
      ? t("conversation.composer.sendButton.steerTitle", { shortcut: alternateSubmitShortcutLabel })
      : composerBehavior.submitAction === "send_steer"
        ? sendButtonAriaLabel
        : t(`${composerBehavior.ariaLabelKey}Title`);
  const selectedHarnessLabel = shouldLockDirectWorker
    ? lockedDirectWorkerLabel
    : composerWorkerOptions.find((option) => option.value === selectedCliAgent)?.label ?? selectedCliAgent;
  const selectedModelLabel = activeWorkerModelOptions.find((option) => option.value === selectedModel)?.label ?? selectedModel;
  const mobileSettingsSummary = `${selectedHarnessLabel} · ${selectedModelLabel}`;
  const composerPlaceholder = selectedRunId
    ? selectedConversationMode === "planning"
      ? t("conversation.composer.placeholder.planning")
      : selectedConversationMode === "direct"
        ? t("conversation.composer.placeholder.direct")
        : t("conversation.composer.placeholder.implementation")
    : t("conversation.composer.placeholder.default");

  return (
  <div className={cn("relative z-20 w-full shrink-0 bg-background p-3 sm:p-4", className)}>
    <form
      onSubmit={(event) => {
        if (isStopButtonVisible) {
          event.preventDefault();
          if (isStopConversationPending) {
            return;
          }
          onStopConversation();
          return;
        }

        handleSubmit(event);
      }}
      className="group relative mx-auto max-w-3xl"
    >
      {!selectedRunId ? (
        <ConversationModePicker
          // Only rendered for a new conversation, where the composer mode is
          // always a pickable option ("omni" | "direct").
          value={selectedConversationMode as ConversationModeOption}
          onChange={setSelectedConversationMode}
          disabled={isComposerSubmitting}
        />
      ) : null}
      <QueuedMessageDrawer
        messages={queuedMessages}
        cancellingMessageIds={cancellingQueuedMessageIds}
        interruptingMessageIds={interruptingQueuedMessageIds}
        themeMode={themeMode}
        onEdit={onEditQueuedMessage}
        onInterruptSendNow={onInterruptQueuedMessage}
        onCancel={onCancelQueuedMessage}
      />
      <div className="relative">
        {showMentionPicker && (
          <div className="absolute inset-x-0 bottom-full z-30 mb-3 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
            <div className="border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
              {currentProjectScope}
            </div>
            <div className="max-h-[min(45dvh,18rem)] overflow-y-auto p-2">
              {filteredProjectFiles.length > 0 ? (
                filteredProjectFiles.map((filePath, index) => (
                  <div
                    key={filePath}
                    className={`flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      index === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/60"
                    }`}
                  >
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyMention(filePath)}
                      className="min-w-0 flex-1 truncate text-left"
                    >
                      {filePath}
                    </button>
                    {onOpenProjectFile ? (
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenProjectFile(filePath);
                        }}
                        className="ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                        aria-label={`Open ${filePath} in side window`}
                        title={`Open ${filePath} in side window`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
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
          "rounded-[1.5rem] px-4 pb-0 pt-3 transition-all sm:px-5 sm:pb-0 sm:pt-4",
          themeMode === "night"
            ? "border border-transparent bg-muted/80 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)] focus-within:bg-muted/90 dark:bg-[#2f2f2f] dark:focus-within:bg-[#343434]"
            : "rounded-[2rem] border border-[#dededd] bg-[#fdfdfc] shadow-none focus-within:border-[#d2d2d0] focus-within:bg-[#fdfdfc] dark:border-transparent dark:bg-[#2f2f2f] dark:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)] dark:focus-within:bg-[#343434] sm:rounded-[2.35rem]",
        )}
      >
        <textarea
          data-composer-input="true"
          ref={commandInputRef}
          value={command}
          onChange={(e) => {
            setComposerDraft({
              command: e.target.value,
              commandCursor: e.target.selectionStart ?? e.target.value.length,
            });
          }}
          onClick={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
          onKeyUp={(e) => setCommandCursor(e.currentTarget.selectionStart ?? 0)}
          onPaste={(event) => {
            const pastedImages = Array.from(event.clipboardData.items)
              .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
              .map((item) => item.getAsFile())
              .filter((file): file is File => Boolean(file));

            if (pastedImages.length > 0) {
              event.preventDefault();
              onAddPastedImages(pastedImages);
            }
          }}
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

            // Claude Code-style Escape: interrupt the active turn and deliver
            // the busy-composer draft or oldest pending queued message. The
            // mention picker (handled above) keeps Escape priority.
            if (shouldInterruptQueuedMessageKeyDown({
              key: e.key,
              shiftKey: e.shiftKey,
              metaKey: e.metaKey,
              ctrlKey: e.ctrlKey,
              altKey: e.altKey,
              isComposing: e.nativeEvent.isComposing,
            })) {
              const hasDraft = Boolean(trimmedCommand || hasAttachments);
              const hasPendingQueued = queuedMessages.some((message) => message.status === "pending");
              const canInterrupt = Boolean(selectedRunId)
                && isConversationStoppable
                && !showMentionPicker
                && !isComposerSubmitting
                && !isStopConversationPending
                && (hasDraft || hasPendingQueued);
              if (canInterrupt) {
                e.preventDefault();
                onInterruptComposer();
                return;
              }
            }

            if (shouldSubmitComposerKeyDown({
              key: e.key,
              shiftKey: e.shiftKey,
              isMobileViewport: window.matchMedia("(max-width: 639px)").matches,
            })) {
              e.preventDefault();
              const useAlternateBusyAction = shouldUseAlternateComposerSubmitKeyDown({
                key: e.key,
                shiftKey: e.shiftKey,
                metaKey: e.metaKey,
                ctrlKey: e.ctrlKey,
                isApplePlatform: isAppleComposerShortcutPlatform(),
              });
              if (isStopButtonVisible) {
                if (!trimmedCommand && !isStopConversationPending) {
                  onStopConversation();
                }
                return;
              }

              if (!isComposerSubmitting && (trimmedCommand || hasAttachments)) {
                if (selectedRunId && !hasAttachments && isManualStopCommand(command)) {
                  setComposerDraft({ command: "", commandCursor: 0 });
                  onStopConversation();
                  return;
                }
                if (selectedRunId) {
                  onSendConversationMessage(
                    command,
                    resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction, {
                      useAlternate: composerBehavior.allowAlternateBusyAction && useAlternateBusyAction,
                    }),
                  );
                } else {
                  onRunCommand(command);
                }
              }
            }
          }}
          placeholder={composerPlaceholder}
          disabled={isComposerSubmitting}
          rows={1}
          className={cn(
            "omni-composer-input w-full resize-none bg-transparent text-[15px] outline-none",
            hasAttachments ? "min-h-[152px] sm:min-h-[112px]" : "min-h-[112px] sm:min-h-[72px]",
            themeMode === "night"
              ? "text-foreground placeholder:text-muted-foreground/80"
              : "text-[#454545] placeholder:text-[#c4c4c2] dark:text-foreground dark:placeholder:text-muted-foreground/80",
          )}
        />

        {attachments.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={cn(
                  attachment.kind === "image"
                    ? "inline-flex max-w-full items-center gap-2 rounded-2xl px-2 py-1.5 text-xs shadow-sm"
                    : "inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-sm",
                  themeMode === "night"
                    ? "bg-background/65 text-foreground dark:bg-black/20"
                    : "border border-[#e2e2df] bg-white/95 text-[#4d4d4d] dark:border-transparent dark:bg-black/20 dark:text-foreground",
                )}
              >
                {attachment.kind === "image" && attachment.previewUrl ? (
                  <Image
                    src={attachment.previewUrl}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : null}
                <span className="truncate">{attachment.name}</span>
                <span className="shrink-0 text-[10px] opacity-60">{formatBytes(attachment.size)}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className={cn(
                    "inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                    themeMode === "night"
                      ? "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                      : "text-[#8f8f8f] hover:bg-black/5 hover:text-[#5c5c5c] dark:text-muted-foreground dark:hover:bg-background/60 dark:hover:text-foreground",
                  )}
                  aria-label={`Remove ${attachment.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-0 flex items-center gap-1 pb-2 sm:gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.currentTarget.files ?? []);
              if (files.length > 0) {
                onAddAttachmentFiles(files);
              }
              event.currentTarget.value = "";
            }}
          />
          <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "h-8 w-8 shrink-0 rounded-full",
                themeMode === "night"
                  ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
                  : "text-[#959595] hover:bg-black/[0.04] hover:text-[#666666] dark:text-muted-foreground dark:hover:bg-background/45 dark:hover:text-foreground",
              )}
              aria-label="Attach files"
            >
              <Plus className="h-[18px] w-[18px]" />
            </Button>

          {!selectedRunId ? (
            <BranchWorkspaceButton
              projectPath={workspaceProjectPath}
              disabled={isComposerSubmitting}
              themeMode={themeMode}
            />
          ) : null}

          {/* Desktop selectors — hidden on mobile */}
          <div className="ml-auto hidden min-w-0 items-center justify-end gap-1 sm:flex sm:gap-2">
            {shouldLockDirectWorker ? (
              <div className={cn(
                "w-max min-w-0 max-w-[8.5rem] shrink truncate rounded-full border px-2 py-1 text-xs font-semibold sm:px-3",
                themeMode === "night"
                  ? "border-border/60 bg-background/50 text-muted-foreground"
                  : "border-[#d8d8d8] bg-white/90 text-[#6a6a6a] dark:border-border/60 dark:bg-background/50 dark:text-muted-foreground",
              )}>
                {lockedDirectWorkerLabel}
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

            <>
              <ComposerModelPicker
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
            </>
          </div>

          {/* Mobile settings button — hidden on desktop */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => composerUiManager.setMobileSettingsOpen(true)}
            className={cn(
              "ml-auto flex h-8 min-w-0 max-w-[min(13rem,48vw)] shrink items-center gap-1.5 rounded-full px-2 text-xs font-medium sm:hidden",
              themeMode === "night"
                ? "text-muted-foreground hover:bg-background/45 hover:text-foreground"
                : "text-[#959595] hover:bg-black/[0.04] hover:text-[#666666] dark:text-muted-foreground dark:hover:bg-background/45 dark:hover:text-foreground",
            )}
            aria-label={t("conversation.composer.settings.title")}
            title={mobileSettingsSummary}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            <span className="min-w-0 truncate">
              {selectedHarnessLabel}
            </span>
            <span className="shrink-0 text-muted-foreground/55" aria-hidden="true">·</span>
            <span className="min-w-0 truncate">
              {selectedModelLabel}
            </span>
          </Button>

          {showSeparateStopButton && (
            <Button
              type="button"
              size="icon"
              disabled={isStopConversationPending}
              aria-label={t("conversation.composer.sendButton.stop")}
              title={t("conversation.composer.sendButton.stopTitle")}
              onClick={onStopConversation}
              className={cn(
                "h-8 w-8 shrink-0 rounded-full transition-all",
                themeMode === "night"
                  ? "border border-red-300/15 bg-red-400/[0.06] text-red-100/85 hover:bg-red-400/[0.12] disabled:opacity-50"
                  : "border border-stone-300/80 bg-stone-100/40 text-stone-500 hover:border-rose-300/70 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-red-300/15 dark:bg-red-400/[0.06] dark:text-red-100/85 dark:hover:bg-red-400/[0.12]",
              )}
            >
              {isStopConversationPending ? (
                <LoaderCircle className="h-[17px] w-[17px] animate-spin" />
              ) : (
                <Square className="h-[13.6px] w-[13.6px] fill-current" />
              )}
            </Button>
          )}

          <Button
            type="submit"
            size="icon"
            disabled={isSubmitButtonDisabled}
            aria-label={sendButtonAriaLabel}
            title={sendButtonTitle}
            className={cn(
              "h-8 w-8 shrink-0 rounded-full transition-all",
              themeMode === "night"
                ? "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/[0.45]"
                : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-primary/[0.45]",
            )}
          >
            {isSendButtonBusy || isStopButtonBusy ? (
              <LoaderCircle className="h-[17px] w-[17px] animate-spin" />
            ) : isStopButtonVisible ? (
              <Square className="h-[13.6px] w-[13.6px] fill-current" />
            ) : (
              <ArrowUp className="h-[17px] w-[17px]" />
            )}
          </Button>
        </div>
      </div>
      </div>
    </form>

      {/* Mobile settings sheet */}
      <Sheet open={mobileSettingsOpen} onOpenChange={composerUiManager.setMobileSettingsOpen}>
        <SheetContent side="bottom" className="px-4 pb-8 pt-0">
          <SheetHeader className="pb-2">
            <SheetTitle>{t("conversation.composer.settings.title")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-5">
            {shouldLockDirectWorker ? (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("conversation.composer.settings.agent")}</span>
                <span className="text-sm text-muted-foreground">{lockedDirectWorkerLabel}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t("conversation.composer.settings.agent")}</span>
                <ComposerSelect
                  ariaLabel="CLI harness"
                  value={selectedCliAgent}
                  options={composerWorkerOptions}
                  onChange={setSelectedCliAgent}
                  themeMode={themeMode}
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("conversation.composer.settings.model")}</span>
              <ComposerModelPicker
                value={selectedModel}
                options={activeWorkerModelOptions}
                onChange={setSelectedModel}
                themeMode={themeMode}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{t("conversation.composer.settings.effort")}</span>
              <ComposerSelect
                ariaLabel="Worker effort"
                value={selectedEffort}
                options={EFFORT_OPTIONS.map((effort) => ({ value: effort, label: effort }))}
                onChange={setSelectedEffort}
                themeMode={themeMode}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>
  </div>
  );
}
