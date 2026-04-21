import { describe, expect, it } from "vitest";
import { getActiveMentionQuery, replaceActiveMention } from "@/lib/mentions";

describe("mentions helpers", () => {
  it("returns the active mention query at the cursor", () => {
    expect(getActiveMentionQuery("implement plan with @src/com", 29)).toEqual({
      start: 20,
      end: 29,
      query: "src/com",
    });
  });

  it("ignores @ that are not at the start of a token", () => {
    expect(getActiveMentionQuery("email test@example.com", 22)).toBeNull();
  });

  it("replaces the active mention with the selected file path", () => {
    expect(replaceActiveMention("implement @src/com", { start: 10, end: 18, query: "src/com" }, "src/components/Button.tsx")).toBe(
      "implement @src/components/Button.tsx "
    );
  });
});
