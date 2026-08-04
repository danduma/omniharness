import { StateManager } from "@/lib/state-manager";
import type { MessageRecord } from "./types";

/**
 * Single source of truth for messages this client has sent but not yet seen
 * come back on the event stream.
 *
 * This replaced three parallel refs (`pendingSentConversationMessagesRef`,
 * `locallySentMessageIdsRef`, `sendingMessageIdsRef`) that described one
 * lifecycle between them. Refs were the wrong home twice over: mutating a
 * `Set` in place never re-rendered the components reading it — the send-time
 * dimming cleared on whatever unrelated render happened next — and the three
 * could disagree about the same message.
 *
 * Lifecycle of one send:
 *   beginSend   POST issued; row rendered optimistically, still `inFlight`
 *   settleSend  POST returned; the row is real, but the stream has not
 *               carried it yet, so it stays as a re-injection guard
 *   failSend    POST rejected; drop the row
 *   acknowledge the stream carried it; the server copy takes over
 */
export type SentConversationMessageEntry = {
  message: MessageRecord;
  /**
   * The POST has not settled. Such a row can never be stale, so the
   * staleness checks that guard against resurrecting old rows must not
   * apply to it.
   */
  inFlight: boolean;
};

type SentConversationMessagesState = {
  entries: ReadonlyMap<string, SentConversationMessageEntry>;
};

const EMPTY_STATE: SentConversationMessagesState = { entries: new Map() };

export class SentConversationMessagesManager extends StateManager<SentConversationMessagesState> {
  constructor() {
    super(EMPTY_STATE);
  }

  private write(mutate: (draft: Map<string, SentConversationMessageEntry>) => boolean) {
    return this.update((current) => {
      const draft = new Map(current.entries);
      return mutate(draft) ? { entries: draft } : current;
    });
  }

  beginSend(message: MessageRecord) {
    this.write((draft) => {
      draft.set(message.id, { message, inFlight: true });
      return true;
    });
  }

  /**
   * The POST settled. `message` is the persisted row, which normally carries
   * the same id the optimistic row already used (the client supplies it as
   * `clientMessageId`); a server that minted its own id instead is handled by
   * dropping the optimistic entry and tracking the returned one. A send that
   * produced no row — queued behind a busy worker — just clears.
   */
  settleSend(sentMessageId: string, message: MessageRecord | null | undefined) {
    this.write((draft) => {
      const had = draft.delete(sentMessageId);
      if (message) {
        draft.set(message.id, { message, inFlight: false });
        return true;
      }
      return had;
    });
  }

  failSend(sentMessageId: string) {
    this.write((draft) => draft.delete(sentMessageId));
  }

  /**
   * A row the server handed back outside the optimistic send path — a queued
   * message released to the worker. There was no optimistic bubble to swap,
   * but it still needs shadowing until the stream carries it.
   */
  trackDeliveredMessage(message: MessageRecord) {
    this.write((draft) => {
      draft.set(message.id, { message, inFlight: false });
      return true;
    });
  }

  /** The event stream now carries these rows; stop shadowing them. */
  acknowledge(messageIds: readonly string[]) {
    if (messageIds.length === 0) {
      return;
    }
    this.write((draft) => messageIds.reduce(
      (changed, messageId) => draft.delete(messageId) || changed,
      false,
    ));
  }

  getPendingMessages(): ReadonlyMap<string, MessageRecord> {
    const pending = new Map<string, MessageRecord>();
    for (const [messageId, entry] of this.getSnapshot().entries) {
      pending.set(messageId, entry.message);
    }
    return pending;
  }

  getInFlightMessageIds(): ReadonlySet<string> {
    const inFlight = new Set<string>();
    for (const [messageId, entry] of this.getSnapshot().entries) {
      if (entry.inFlight) {
        inFlight.add(messageId);
      }
    }
    return inFlight;
  }

  /**
   * Every message this client sent this session. `Terminal` uses it to place
   * a fallback row immediately instead of waiting to rule out that the row is
   * hiding in an unfetched history page — a message we just sent cannot be.
   */
  getLocallySentMessageIds(): ReadonlySet<string> {
    return new Set(this.getSnapshot().entries.keys());
  }
}

export const sentConversationMessagesManager = new SentConversationMessagesManager();
