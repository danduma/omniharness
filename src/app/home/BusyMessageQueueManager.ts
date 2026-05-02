"use client";

import { StateManager } from "@/lib/state-manager";
import type { QueuedConversationMessageRecord } from "./types";

type BusyMessageQueueState = {
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
};

const initialBusyMessageQueueState: BusyMessageQueueState = {
  queuedMessages: [],
  cancellingMessageIds: new Set(),
};

export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
  constructor() {
    super(initialBusyMessageQueueState);
  }

  setQueuedMessages(messages: QueuedConversationMessageRecord[]) {
    this.setKey("queuedMessages", messages);
  }

  upsertQueuedMessage(message: QueuedConversationMessageRecord) {
    this.setKey("queuedMessages", (current) => {
      const existingIndex = current.findIndex((entry) => entry.id === message.id);
      if (existingIndex === -1) {
        return [...current, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
      cancellingMessageIds.delete(messageId);
      return {
        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
        cancellingMessageIds,
      };
    });
  }
}

export const busyMessageQueueManager = new BusyMessageQueueManager();
