import { describe, expect, it } from "vitest";
import { getRunLatestMessageTimestamp, isRunUnread } from "@/lib/conversation-state";

describe("conversation-state helpers", () => {
  it("returns the latest message timestamp for a run", () => {
    const latest = getRunLatestMessageTimestamp("run-1", [
      { runId: "run-1", createdAt: "2026-04-20T10:00:00.000Z" },
      { runId: "run-2", createdAt: "2026-04-20T11:00:00.000Z" },
      { runId: "run-1", createdAt: "2026-04-20T12:00:00.000Z" },
    ]);

    expect(latest).toBe("2026-04-20T12:00:00.000Z");
  });

  it("treats a run as unread when there are newer messages than the last read marker", () => {
    expect(
      isRunUnread({
        latestMessageAt: "2026-04-20T12:00:00.000Z",
        lastReadAt: "2026-04-20T11:00:00.000Z",
      })
    ).toBe(true);
  });

  it("treats a run as read when the last read marker is current", () => {
    expect(
      isRunUnread({
        latestMessageAt: "2026-04-20T12:00:00.000Z",
        lastReadAt: "2026-04-20T12:00:00.000Z",
      })
    ).toBe(false);
  });
});
