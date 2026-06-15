"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { requestJson } from "@/lib/app-errors";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
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
  pendingSentConversationMessagesRef: React.RefObject<Map<string, MessageRecord>>;
  scrollConversationToBottom: () => void;
}

export function useQueuedMessageMutations({
  setState,
  pendingSentConversationMessagesRef,
  scrollConversationToBottom,
}: UseQueuedMessageMutationsParams) {
  const { setCommand, clearAttachments } = homeUiSetters;

  const cancelQueuedMessage = useMutation({
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "DELETE",
    }, {
      source: "Conversations",
      action: "Cancel queued message",
    }),
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
    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<QueuedMessageMutationResponse>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
      method: "PATCH",
    }, {
      source: "Conversations",
      action: "Send queued message now",
    }),
    onMutate: ({ messageId }) => {
      busyMessageQueueManager.markCancelling(messageId);
    },
    onSuccess: (data, variables) => {
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
      });
      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
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
        return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/${variables.messageId}/interrupt`, {
          method: "POST",
        }, {
          source: "Conversations",
          action: "Interrupt and send queued message",
        });
      }

      const uploadedAttachments = variables.draft
        ? await uploadPendingChatAttachments(variables.draft.attachments)
        : [];
      return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/interrupt-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(variables.draft
          ? { content: variables.draft.content, attachments: uploadedAttachments }
          : {}),
      }, {
        source: "Conversations",
        action: "Interrupt and send queued message",
      });
    },
    onSuccess: (data, variables, context) => {
      const snapshot = homeUiStateManager.getSnapshot();
      const ownsSideEffects = ownsConversationSideEffects({
        runId: variables.runId,
        currentSelectedRunId: snapshot.selectedRunId,
      });

      if (data.message) {
        pendingSentConversationMessagesRef.current.set(data.message.id, data.message);
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
