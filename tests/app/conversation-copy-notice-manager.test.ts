import { describe, expect, test, vi } from "vitest";
import { ConversationCopyNoticeManager } from "@/components/component-state-managers";

describe("ConversationCopyNoticeManager", () => {
  test("shows and automatically clears copied message notices", () => {
    vi.useFakeTimers();
    try {
      const manager = new ConversationCopyNoticeManager();

      manager.showCopiedMessage("message-a");

      expect(manager.getSnapshot().copiedMessageId).toBe("message-a");

      vi.advanceTimersByTime(1_800);

      expect(manager.getSnapshot().copiedMessageId).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("keeps the newest copied message visible when notices overlap", () => {
    vi.useFakeTimers();
    try {
      const manager = new ConversationCopyNoticeManager();

      manager.showCopiedMessage("message-a");
      vi.advanceTimersByTime(900);
      manager.showCopiedMessage("message-b");
      vi.advanceTimersByTime(900);

      expect(manager.getSnapshot().copiedMessageId).toBe("message-b");

      vi.advanceTimersByTime(900);

      expect(manager.getSnapshot().copiedMessageId).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
