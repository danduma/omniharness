"use client";

import type React from "react";
import { useEffect, useMemo } from "react";
import { ConversationComposer } from "@/components/home/ConversationComposer";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { shallowEqualRecord, useManagerSelector } from "@/lib/use-manager-snapshot";
import {
  resolveBusyComposerBehavior,
  resolveBusyMessageActionForSubmitAction,
  type BusyMessageAction,
} from "./busy-message-behavior";
import { homeUiSetters, homeUiStateManager, type HomeUiState } from "./HomeUiStateManager";
import type {
  ComposerWorkerOption,
  ConversationModeOption,
  QueuedConversationMessageRecord,
  WorkerModelOption,
} from "./types";

export interface ComposerContainerProps {
  className: string;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedRunId: string | null;
  selectedConversationMode: ConversationModeOption;
  setSelectedConversationMode: (value: ConversationModeOption) => void;
  currentProjectScope: string | null;
  projectFiles: string[];
  projectFilesIsFetched: boolean;
  onOpenProjectFile: (f: string | ProjectFileReference) => void;
  themeMode: "day" | "night";
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
  hasBusyConversation: boolean;
  busyMessageAction: BusyMessageAction;
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingQueuedMessageIds: Set<string>;
  onEditQueuedMessage: (message: QueuedConversationMessageRecord) => void;
  onSendQueuedMessageNow: (messageId: string) => void;
  onCancelQueuedMessage: (messageId: string) => void;
  onSendConversationMessage: (content: string, attachments: PendingChatAttachment[], busyAction?: BusyMessageAction) => void;
  onRunCommand: (content: string, attachments: PendingChatAttachment[]) => void;
  onStopConversation: () => void;
}

// Isolates high-churn draft subscriptions so keystrokes don't re-render HomeApp
export function ComposerContainer({
  className,
  commandInputRef,
  selectedRunId,
  selectedConversationMode,
  setSelectedConversationMode,
  currentProjectScope,
  projectFiles,
  projectFilesIsFetched,
  onOpenProjectFile,
  themeMode,
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
  hasBusyConversation,
  busyMessageAction,
  queuedMessages,
  cancellingQueuedMessageIds,
  onEditQueuedMessage,
  onSendQueuedMessageNow,
  onCancelQueuedMessage,
  onSendConversationMessage,
  onRunCommand,
  onStopConversation,
}: ComposerContainerProps) {
  const { setCommand, setCommandCursor, setMentionIndex, addAttachmentFiles, addPastedImages, removeAttachment } = homeUiSetters;

  const { command, commandCursor, mentionIndex, attachments } = useManagerSelector(
    homeUiStateManager,
    (s: HomeUiState) => ({
      command: s.command,
      commandCursor: s.commandCursor,
      mentionIndex: s.mentionIndex,
      attachments: s.attachments,
    }),
    shallowEqualRecord,
  );

  const activeMention = getActiveMentionQuery(command, commandCursor);

  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) return [];
    const needle = activeMention.query.toLowerCase();
    return projectFiles
      .filter((f) => needle.length === 0 || f.toLowerCase().includes(needle))
      .slice(0, 12);
  }, [activeMention, projectFiles]);

  const showMentionPicker = Boolean(
    activeMention && currentProjectScope && (filteredProjectFiles.length > 0 || projectFilesIsFetched),
  );

  const composerBehavior = resolveBusyComposerBehavior({
    hasBusyConversation,
    isConversationStoppable,
    hasContent: Boolean(command.trim() || attachments.length > 0),
    busyMessageAction,
  });

  useEffect(() => {
    setMentionIndex(0);
  }, [activeMention?.query, currentProjectScope, setMentionIndex]);

  const applyMention = (filePath: string) => {
    if (!activeMention) return;
    const nextValue = replaceActiveMention(command, activeMention, filePath);
    const nextCursor = activeMention.start + filePath.length + 2;
    setCommand(nextValue);
    setCommandCursor(nextCursor);
    requestAnimationFrame(() => {
      commandInputRef.current?.focus();
      commandInputRef.current?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (composerBehavior.submitAction === "stop") { onStopConversation(); return; }
    if (!command.trim() && attachments.length === 0) return;
    if (selectedRunId) {
      onSendConversationMessage(command, attachments, resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction));
      return;
    }
    onRunCommand(command, attachments);
  };

  return (
    <ConversationComposer
      className={className}
      command={command}
      setCommand={setCommand}
      setCommandCursor={setCommandCursor}
      commandInputRef={commandInputRef}
      handleSubmit={handleSubmit}
      selectedRunId={selectedRunId}
      selectedConversationMode={selectedConversationMode}
      setSelectedConversationMode={setSelectedConversationMode}
      showMentionPicker={showMentionPicker}
      currentProjectScope={currentProjectScope}
      filteredProjectFiles={filteredProjectFiles}
      mentionIndex={mentionIndex}
      setMentionIndex={setMentionIndex}
      applyMention={applyMention}
      onOpenProjectFile={onOpenProjectFile}
      themeMode={themeMode}
      attachments={attachments}
      handleRemoveAttachment={removeAttachment}
      onAddAttachmentFiles={addAttachmentFiles}
      onAddPastedImages={addPastedImages}
      shouldLockDirectWorker={shouldLockDirectWorker}
      lockedDirectWorkerLabel={lockedDirectWorkerLabel}
      selectedCliAgent={selectedCliAgent}
      setSelectedCliAgent={setSelectedCliAgent}
      composerWorkerOptions={composerWorkerOptions}
      selectedModel={selectedModel}
      setSelectedModel={setSelectedModel}
      activeWorkerModelOptions={activeWorkerModelOptions}
      selectedEffort={selectedEffort}
      setSelectedEffort={setSelectedEffort}
      isComposerSubmitting={isComposerSubmitting}
      isStopConversationPending={isStopConversationPending}
      isConversationStoppable={isConversationStoppable}
      composerBehavior={composerBehavior}
      queuedMessages={queuedMessages}
      cancellingQueuedMessageIds={cancellingQueuedMessageIds}
      onEditQueuedMessage={onEditQueuedMessage}
      onSendQueuedMessageNow={onSendQueuedMessageNow}
      onCancelQueuedMessage={onCancelQueuedMessage}
      onSendConversationMessage={(content, busyAction) => onSendConversationMessage(content, attachments, busyAction)}
      onRunCommand={(content) => onRunCommand(content, attachments)}
      onStopConversation={onStopConversation}
    />
  );
}
