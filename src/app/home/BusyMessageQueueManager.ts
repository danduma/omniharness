"use client";

import { StateManager } from "@/lib/state-manager";
import type { QueuedConversationMessageRecord } from "./types";
import { compareOldestByCreatedAtThenId } from "./utils";

type BusyMessageQueueState = {
  queuedMessages: QueuedConversationMessageRecord[];
  cancellingMessageIds: Set<string>;
  // Rows the user has asked to interrupt-and-send ("force send"). Optimistic
  // UI only — server queue rows from /api/events remain authoritative.
  interruptingMessageIds: Set<string>;
  locallyHiddenMessageIds: Set<string>;
  serverAbsentMessageUpdatedAtById: Map<string, number>;
};

const initialBusyMessageQueueState: BusyMessageQueueState = {
  queuedMessages: [],
  cancellingMessageIds: new Set(),
  interruptingMessageIds: new Set(),
  locallyHiddenMessageIds: new Set(),
  serverAbsentMessageUpdatedAtById: new Map(),
};

function isActiveQueuedMessage(message: QueuedConversationMessageRecord) {
  return message.status === "pending" || message.status === "delivering";
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isStaleServerAbsentActiveMessage(
  message: QueuedConversationMessageRecord,
  serverAbsentMessageUpdatedAtById: Map<string, number>,
) {
  if (!isActiveQueuedMessage(message)) {
    return false;
  }
  const absentUpdatedAt = serverAbsentMessageUpdatedAtById.get(message.id);
  return absentUpdatedAt !== undefined && timestampMs(message.updatedAt) <= absentUpdatedAt;
}

export class BusyMessageQueueManager extends StateManager<BusyMessageQueueState> {
  constructor() {
    super(initialBusyMessageQueueState);
  }

  setQueuedMessages(messages: QueuedConversationMessageRecord[], notify = true) {
    this.update((current) => {
      const incomingMessages = messages.filter(
        (message) => !isStaleServerAbsentActiveMessage(message, current.serverAbsentMessageUpdatedAtById),
      );
      const incomingIds = new Set(incomingMessages.map((message) => message.id));
      const newlyAbsentActiveIds = current.queuedMessages
        .filter((message) => isActiveQueuedMessage(message) && !incomingIds.has(message.id))
        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
      // Server rows are authoritative: clear optimistic interrupt/cancel flags
      // for any row that has left a pending/delivering state.
      const settledIds = new Set(
        [
          ...incomingMessages
            .filter((message) => !isActiveQueuedMessage(message))
            .map((message) => message.id),
          ...newlyAbsentActiveIds.map(([id]) => id),
        ],
      );
      const clearSettled = (ids: Set<string>) => {
        if (settledIds.size === 0) {
          return ids;
        }
        let changed = false;
        const next = new Set(ids);
        for (const id of settledIds) {
          if (next.delete(id)) {
            changed = true;
          }
        }
        return changed ? next : ids;
      };
      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
      for (const [id, updatedAt] of newlyAbsentActiveIds) {
        serverAbsentMessageUpdatedAtById.set(id, updatedAt);
      }
      for (const message of incomingMessages) {
        serverAbsentMessageUpdatedAtById.delete(message.id);
      }
      return {
        ...current,
        queuedMessages: incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
        cancellingMessageIds: clearSettled(current.cancellingMessageIds),
        interruptingMessageIds: clearSettled(current.interruptingMessageIds),
        serverAbsentMessageUpdatedAtById,
      };
    }, notify);
  }

  getQueuedMessagesForRun(runId: string | null | undefined) {
    const normalizedRunId = runId?.trim();
    if (!normalizedRunId) {
      return [];
    }
    return this.getSnapshot().queuedMessages.filter((message) => message.runId === normalizedRunId);
  }

  upsertQueuedMessage(message: QueuedConversationMessageRecord) {
    this.update((current) => {
      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
      if (isStaleServerAbsentActiveMessage(message, serverAbsentMessageUpdatedAtById)) {
        return current;
      }

      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      if (!isActiveQueuedMessage(message)) {
        cancellingMessageIds.delete(message.id);
        interruptingMessageIds.delete(message.id);
        serverAbsentMessageUpdatedAtById.set(message.id, timestampMs(message.updatedAt));
        return {
          ...current,
          queuedMessages: current.queuedMessages.filter((entry) => entry.id !== message.id),
          cancellingMessageIds,
          interruptingMessageIds,
          serverAbsentMessageUpdatedAtById,
        };
      }

      serverAbsentMessageUpdatedAtById.delete(message.id);
      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
      if (existingIndex === -1) {
        return {
          ...current,
          queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
          serverAbsentMessageUpdatedAtById,
        };
      }

      const next = [...current.queuedMessages];
      next[existingIndex] = message;
      return {
        ...current,
        queuedMessages: next,
        serverAbsentMessageUpdatedAtById,
      };
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

  markInterrupting(messageId: string) {
    this.setKey("interruptingMessageIds", (current) => new Set([...current, messageId]));
  }

  unmarkInterrupting(messageId: string) {
    this.setKey("interruptingMessageIds", (current) => {
      const next = new Set(current);
      next.delete(messageId);
      return next;
    });
  }

  hideQueuedMessage(messageId: string) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      cancellingMessageIds.delete(messageId);
      interruptingMessageIds.delete(messageId);
      locallyHiddenMessageIds.add(messageId);
      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
      const existing = current.queuedMessages.find((message) => message.id === messageId);
      serverAbsentMessageUpdatedAtById.set(messageId, timestampMs(existing?.updatedAt));
      return {
        queuedMessages: current.queuedMessages.filter((message) => message.id !== messageId),
        cancellingMessageIds,
        interruptingMessageIds,
        locallyHiddenMessageIds,
        serverAbsentMessageUpdatedAtById,
      };
    });
  }

  restoreQueuedMessage(message: QueuedConversationMessageRecord) {
    this.patch((current) => {
      const cancellingMessageIds = new Set(current.cancellingMessageIds);
      const interruptingMessageIds = new Set(current.interruptingMessageIds);
      const locallyHiddenMessageIds = new Set(current.locallyHiddenMessageIds);
      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
      cancellingMessageIds.delete(message.id);
      interruptingMessageIds.delete(message.id);
      locallyHiddenMessageIds.delete(message.id);
      serverAbsentMessageUpdatedAtById.delete(message.id);
      const existingIndex = current.queuedMessages.findIndex((entry) => entry.id === message.id);
      const queuedMessages = existingIndex === -1
        ? [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId)
        : current.queuedMessages.map((entry) => entry.id === message.id ? message : entry);
      return {
        queuedMessages,
        cancellingMessageIds,
        interruptingMessageIds,
        locallyHiddenMessageIds,
        serverAbsentMessageUpdatedAtById,
      };
    });
  }
}

export const busyMessageQueueManager = new BusyMessageQueueManager();
