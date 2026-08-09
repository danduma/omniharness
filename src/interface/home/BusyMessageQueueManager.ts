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
  // Rows this client queued whose POST has not returned. The server cannot
  // have them yet, so "absent from the server list" must not be read as
  // "cancelled" for these — otherwise the row the user just queued blinks out
  // on the next event frame and back in when the POST lands.
  pendingQueuedMessageIds: Set<string>;
};

const initialBusyMessageQueueState: BusyMessageQueueState = {
  queuedMessages: [],
  cancellingMessageIds: new Set(),
  interruptingMessageIds: new Set(),
  locallyHiddenMessageIds: new Set(),
  serverAbsentMessageUpdatedAtById: new Map(),
  pendingQueuedMessageIds: new Set(),
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

function attachmentsEqual(
  left: QueuedConversationMessageRecord["attachments"],
  right: QueuedConversationMessageRecord["attachments"],
) {
  const leftAttachments = left ?? [];
  const rightAttachments = right ?? [];
  if (leftAttachments.length !== rightAttachments.length) {
    return false;
  }
  return leftAttachments.every((attachment, index) => JSON.stringify(attachment) === JSON.stringify(rightAttachments[index]));
}

function queuedMessageRecordsEqual(left: QueuedConversationMessageRecord, right: QueuedConversationMessageRecord) {
  return left.id === right.id
    && left.runId === right.runId
    && left.targetWorkerId === right.targetWorkerId
    && left.action === right.action
    && left.content === right.content
    && left.status === right.status
    && left.lastError === right.lastError
    && left.createdAt === right.createdAt
    && left.updatedAt === right.updatedAt
    && left.deliveredAt === right.deliveredAt
    && attachmentsEqual(left.attachments, right.attachments);
}

function queuedMessageArraysEqual(left: QueuedConversationMessageRecord[], right: QueuedConversationMessageRecord[]) {
  return left.length === right.length
    && left.every((message, index) => queuedMessageRecordsEqual(message, right[index]!));
}

function setsEqual<T>(left: Set<T>, right: Set<T>) {
  if (left === right) {
    return true;
  }
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

function mapsEqual<TKey, TValue>(left: Map<TKey, TValue>, right: Map<TKey, TValue>) {
  if (left === right) {
    return true;
  }
  if (left.size !== right.size) {
    return false;
  }
  for (const [key, value] of left) {
    if (!Object.is(right.get(key), value)) {
      return false;
    }
  }
  return true;
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
      // A row whose POST is still in flight is not "gone from the server", it
      // has not reached the server yet. Leave it out of the absence
      // bookkeeping entirely so it is neither dropped now nor rejected as
      // stale when the real row arrives.
      const newlyAbsentActiveIds = current.queuedMessages
        .filter((message) => (
          isActiveQueuedMessage(message)
          && !incomingIds.has(message.id)
          && !current.pendingQueuedMessageIds.has(message.id)
        ))
        .map((message) => [message.id, timestampMs(message.updatedAt)] as const);
      const retainedPendingMessages = current.queuedMessages.filter((message) => (
        current.pendingQueuedMessageIds.has(message.id) && !incomingIds.has(message.id)
      ));
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
      const queuedMessages = [
        ...incomingMessages.filter((message) => !current.locallyHiddenMessageIds.has(message.id)),
        ...retainedPendingMessages,
      ].sort(compareOldestByCreatedAtThenId);
      const cancellingMessageIds = clearSettled(current.cancellingMessageIds);
      const interruptingMessageIds = clearSettled(current.interruptingMessageIds);
      if (
        queuedMessageArraysEqual(current.queuedMessages, queuedMessages)
        && setsEqual(current.cancellingMessageIds, cancellingMessageIds)
        && setsEqual(current.interruptingMessageIds, interruptingMessageIds)
        && mapsEqual(current.serverAbsentMessageUpdatedAtById, serverAbsentMessageUpdatedAtById)
      ) {
        return current;
      }
      return {
        ...current,
        queuedMessages,
        cancellingMessageIds,
        interruptingMessageIds,
        serverAbsentMessageUpdatedAtById,
      };
    }, notify);
  }

  /**
   * The rows the drawer should actually render.
   *
   * A message id must appear exactly once across the whole conversation
   * surface, but the transcript and this drawer are separate lists, so neither
   * one's dedup can see the other's copy. The composer predicts busy-ness from
   * event-stream state, so it can render a message as a transcript bubble that
   * the server then decides to queue; the queue row reaches the client on the
   * event stream before the POST returns, and the text is on screen twice
   * until it does. Suppress the row for as long as the send owns a transcript
   * bubble — when the POST settles it decides which surface keeps the message.
   *
   * `inFlightSentMessageIds` is passed in rather than mirrored into this
   * manager's state: `SentConversationMessagesManager` already owns that fact,
   * and a second copy could disagree with it.
   */
  getVisibleQueuedMessagesForRun(
    runId: string | null | undefined,
    inFlightSentMessageIds: ReadonlySet<string>,
  ) {
    return this.getQueuedMessagesForRun(runId)
      .filter((message) => !inFlightSentMessageIds.has(message.id));
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

  /**
   * Show a row in the queue from the moment the user hits send, rather than
   * after the POST returns. A message sent with `busyAction: "queue"` is
   * always queued server-side, so the prediction cannot be wrong — and
   * rendering it as a sent bubble in the meantime made it appear in the
   * transcript for the length of the round trip before jumping to the queue.
   */
  beginQueueSend(message: QueuedConversationMessageRecord) {
    this.patch((current) => {
      const pendingQueuedMessageIds = new Set(current.pendingQueuedMessageIds);
      pendingQueuedMessageIds.add(message.id);
      const serverAbsentMessageUpdatedAtById = new Map(current.serverAbsentMessageUpdatedAtById);
      serverAbsentMessageUpdatedAtById.delete(message.id);
      return {
        queuedMessages: [...current.queuedMessages, message].sort(compareOldestByCreatedAtThenId),
        pendingQueuedMessageIds,
        serverAbsentMessageUpdatedAtById,
      };
    });
  }

  /**
   * The POST returned. The server row normally carries the id the optimistic
   * row already used, so this is an in-place swap; a server that minted its
   * own id instead drops the optimistic row and takes the returned one.
   */
  settleQueueSend(pendingMessageId: string, message: QueuedConversationMessageRecord | null | undefined) {
    this.patch((current) => {
      const pendingQueuedMessageIds = new Set(current.pendingQueuedMessageIds);
      pendingQueuedMessageIds.delete(pendingMessageId);
      const queuedMessages = message && message.id !== pendingMessageId
        ? current.queuedMessages.filter((entry) => entry.id !== pendingMessageId)
        : current.queuedMessages;
      return { pendingQueuedMessageIds, queuedMessages };
    });
    if (message) {
      this.upsertQueuedMessage(message);
    }
  }

  failQueueSend(pendingMessageId: string) {
    this.patch((current) => {
      const pendingQueuedMessageIds = new Set(current.pendingQueuedMessageIds);
      pendingQueuedMessageIds.delete(pendingMessageId);
      return {
        pendingQueuedMessageIds,
        queuedMessages: current.queuedMessages.filter((entry) => entry.id !== pendingMessageId),
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
