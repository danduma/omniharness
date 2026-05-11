"use client";

import type React from "react";
import { useEffect, useMemo } from "react";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";
import { resolveBusyComposerBehavior, resolveBusyMessageActionForSubmitAction, type BusyMessageAction } from "./busy-message-behavior";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { shallowEqualRecord, useManagerSelector } from "@/lib/use-manager-snapshot";
import type { HomeUiState } from "./HomeUiStateManager";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import type { QueuedConversationMessageRecord } from "./types";

type ComposerDraftState = Pick<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;

function selectComposerDraftState(state: HomeUiState): ComposerDraftState {
  return {
    command: state.command,
    commandCursor: state.commandCursor,
    mentionIndex: state.mentionIndex,
    attachments: state.attachments,
  };
}

export interface UseComposerControllerParams {
  selectedRunId: string | null;
  currentProjectScope: string | null;
  projectFiles: string[];
  projectFilesIsFetched: boolean;
  hasBusyConversation: boolean;
  isConversationStoppable: boolean;
  busyMessageAction: BusyMessageAction;
  commandInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSendConversationMessage: (content: string, attachments: PendingChatAttachment[], busyAction?: BusyMessageAction) => void;
  onRunCommand: (content: string, attachments: PendingChatAttachment[]) => void;
  onStopConversation: () => void;
  onEditQueuedMessage: (message: QueuedConversationMessageRecord) => void;
  onCancelQueuedMessage: (messageId: string) => void;
  onSendQueuedMessageNow: (messageId: string) => void;
}

export function useComposerController({
  selectedRunId,
  currentProjectScope,
  projectFiles,
  projectFilesIsFetched,
  hasBusyConversation,
  isConversationStoppable,
  busyMessageAction,
  commandInputRef,
  onSendConversationMessage,
  onRunCommand,
  onStopConversation,
}: UseComposerControllerParams) {
  const { setCommand, setCommandCursor, setMentionIndex } = homeUiSetters;

  const { command, commandCursor, mentionIndex, attachments } = useManagerSelector(
    homeUiStateManager,
    selectComposerDraftState,
    shallowEqualRecord,
  );

  const activeMention = getActiveMentionQuery(command, commandCursor);

  const filteredProjectFiles = useMemo(() => {
    if (!activeMention) return [];
    const needle = activeMention.query.toLowerCase();
    return projectFiles
      .filter((filePath) => needle.length === 0 || filePath.toLowerCase().includes(needle))
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
    if (composerBehavior.submitAction === "stop") {
      onStopConversation();
      return;
    }

    if (!command.trim() && attachments.length === 0) return;

    if (selectedRunId) {
      onSendConversationMessage(
        command,
        attachments,
        resolveBusyMessageActionForSubmitAction(composerBehavior.submitAction),
      );
      return;
    }

    onRunCommand(command, attachments);
  };

  return {
    command,
    commandCursor,
    mentionIndex,
    attachments,
    activeMention,
    filteredProjectFiles,
    showMentionPicker,
    composerBehavior,
    applyMention,
    handleSubmit,
    setCommand,
    setCommandCursor,
    setMentionIndex,
  };
}
