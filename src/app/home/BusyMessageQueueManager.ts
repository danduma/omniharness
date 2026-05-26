"use client";

import { StateManager } from "@/lib/state-manager";
import type { QueuedConversationMessageRecord } from "./types";
import { compareOldestByCreatedAtThenId } from "./utils";

type BusyMessageQueueState = {
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
  locallyHiddenMessageIds: Set<string>;
};

const initialBusyMessageQueueState: BusyMessageQueueState = {
  queuedMessages: [],
  cancellingMessageIds: new Set(),
  locallyHiddenMessageIds: new Set(),
};

export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
  constructor() {
    super(initialBusyMessageQueueState);
  }

  setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
    this.update((current) => ({
      ...current,
      queuedMessages: messages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
    }), notify);
  }

  getQueuedMessagesForRun(runId: string | null | undefined) {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return [];
    }
    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
  }

  upsertQueuedMessage(message: QueuedConversationMessageRecord) {
    this.setKey("queuedMessages", (current) => {
      const existingIndex = current.findIndex((entry) => entry.id === message.id);
      if (existingIndex === -1) {
        return [...current, message].sort(compareOldestByCreatedAtThenId);
      }

      const next = [...current];
      next[existingIndex] = message;
      return next;
    });
  }

  markCancelling(messageId: string) {
    this.setKey("cancellingMessageIds", (current) => new Set([...current, messageId]));
  }

  unmarkCancelling(messageId: string) {
    this.setKey("cancellingMessageIds", (current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }

  hideQueuedMessage(messageId: string) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      cancellingMessageIds.delete(messageId);
      locallyHiddenMessageIds.add(messageId);
      return {
        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
        cancellingMessageIds,
        locallyHiddenMessageIds,
      };
    });
  }

  restoreQueuedMessage(message: QueuedConversationMessageRecord) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      cancellingMessageIds.delete(message.id);
      locallyHiddenMessageIds.delete(message.id);
      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
      const queuedMessages = existingIndex === -1
        ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
        : current.queuedMessages.map((entry) => entry.id === message.id ? message : entry);
      return {
        queuedMessages,
        cancellingMessageIds,
        locallyHiddenMessageIds,
      };
    });
  }
}

export const busyMessageQueueManager = new BusyMessageQueueManager();
