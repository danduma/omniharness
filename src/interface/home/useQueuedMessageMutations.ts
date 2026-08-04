"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { useRuntimeAPIs } from "@/runtime-api/provider";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { sentConversationMessagesManager } from "./SentConversationMessagesManager";
import { uploadPendingChatAttachments } from "./upload-attachments";
import { appendSentConversationMessageSnapshot } from "./utils";
import { ownsConversationSideEffects } from "./useHomeMutations";
import type {
  EventStreamState,
  MessageRecord,
  QueuedMessageInterruptResponse,
} from "./types";

type QueuedMessageMutationResponse = {
  ok: true;
  message?: MessageRecord;
  queuedMessage?: NonNullable<EventStreamState["queuedMessages"]>[number];
};

export interface UseQueuedMessageMutationsParams {
  setState: React.Dispatch<React.SetStateAction<EventStreamState>>;
  scrollConversationToBottom: () => void;
}

export function useQueuedMessageMutations({
  setState,
  scrollConversationToBottom,
}: UseQueuedMessageMutationsParams) {
  const runtimeApis = useRuntimeAPIs();
  const { setCommand, clearAttachments } = homeUiSetters;

  const cancelQueuedMessage = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) =>
      runtimeApis.conversations.removeQueuedMessage({
        runId,
        messageId,
      }) as Promise<{ ok: true }>,
    onMutate: ({ messageId }) => {
      const previousQueuedMessage = busyMessageQueueManager.getSnapshot().queuedMessages.find((message) => message.id === messageId) ?? null;
      busyMessageQueueManager.markCancelling(messageId);
      busyMessageQueueManager.hideQueuedMessage(messageId);
      return { previousQueuedMessage };
    },
    onError: (_error, variables, context) => {
      if (context?.previousQueuedMessage) {
        busyMessageQueueManager.restoreQueuedMessage(context.previousQueuedMessage);
        return;
      }
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  const sendQueuedMessageNow = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) =>
      runtimeApis.conversations.updateQueuedMessage({
        runId,
        messageId,
        body: {},
      }) as Promise<QueuedMessageMutationResponse>,
    onMutate: ({ messageId }) => {
      busyMessageQueueManager.markCancelling(messageId);
    },
    onSuccess: (data, variables) => {
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      });
      if (data.message) {
        sentConversationMessagesManager.trackDeliveredMessage(data.message);
        setState((current) => appendSentConversationMessageSnapshot(current, data.message));
        if (ownsSideEffects) {
          scrollConversationToBottom();
        }
      }

      if (data.message && data.queuedMessage?.status === "delivering") {
        busyMessageQueueManager.hideQueuedMessage(variables.messageId);
        return;
      }

      if (data.queuedMessage && (data.queuedMessage.status === "pending" || data.queuedMessage.status === "delivering")) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
        busyMessageQueueManager.unmarkCancelling(variables.messageId);
        return;
      }

      busyMessageQueueManager.hideQueuedMessage(variables.messageId);
    },
    onError: (_error, variables) => {
      busyMessageQueueManager.unmarkCancelling(variables.messageId);
    },
  });

  // Force-send / Escape interrupt: cancel the active turn and deliver the
  // selected queued message (or a busy-composer draft) immediately.
  const interruptQueuedMessage = useMutation({
    onMutate: (variables: { runId: string; messageId?: string; draft?: { content: string; attachments: PendingChatAttachment[] } }) => {
      if (variables.messageId) {
        busyMessageQueueManager.markInterrupting(variables.messageId);
      }
      return {
        commandAtStart: homeUiStateManager.getSnapshot().command,
        attachmentsAtStart: homeUiStateManager.getSnapshot().attachments,
      };
    },
    mutationFn: async (variables: { runId: string; messageId?: string; draft?: { content: string; attachments: PendingChatAttachment[] } }) => {
      if (variables.messageId) {
        return runtimeApis.conversations.interruptQueuedMessage({
          runId: variables.runId,
          messageId: variables.messageId,
        }) as Promise<QueuedMessageInterruptResponse>;
      }

      const uploadedAttachments = variables.draft
        ? await uploadPendingChatAttachments(
          variables.draft.attachments,
          runtimeApis.files,
        )
        : [];
      return runtimeApis.conversations.interruptNextQueuedMessage({
        runId: variables.runId,
        body: variables.draft
          ? { content: variables.draft.content, attachments: uploadedAttachments }
          : {},
      }) as Promise<QueuedMessageInterruptResponse>;
    },
    onSuccess: (data, variables, context) => {
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });

      if (data.message) {
        sentConversationMessagesManager.trackDeliveredMessage(data.message);
        setState((current) => appendSentConversationMessageSnapshot(current, data.message));
      }
      if (data.queuedMessage) {
        busyMessageQueueManager.upsertQueuedMessage(data.queuedMessage);
      }
      if (variables.messageId) {
        busyMessageQueueManager.unmarkInterrupting(variables.messageId);
      }

      // Owner-token check before clearing the composer: only clear the draft we
      // submitted, and only if the user has not switched runs or edited it.
      if (variables.draft && ownsSideEffects && context
        && snapshot.command === context.commandAtStart
        && snapshot.attachments === context.attachmentsAtStart) {
        setCommand("");
        clearAttachments();
      }

      if (ownsSideEffects) {
        scrollConversationToBottom();
      }
    },
    onError: (_error, variables) => {
      if (variables.messageId) {
        busyMessageQueueManager.unmarkInterrupting(variables.messageId);
      }
    },
  });

  return {
    cancelQueuedMessage,
    sendQueuedMessageNow,
    interruptQueuedMessage,
  };
}
