import { describe, expect, it } from "vitest";
import {
  MANUAL_COMMIT_CHAT_PROMPT,
  MANUAL_COMMIT_CHAT_PUSH_PROMPT,
  getManualCommitPrompt,
  parseBooleanSetting,
  serializeBooleanSetting,
} from "@/lib/commit-workflow";

describe("commit workflow settings", () => {
  it("parses boolean settings with a fallback for missing or unknown values", () => {
    expect(parseBooleanSetting("yes")).toBe(true);
    expect(parseBooleanSetting(" OFF ", true)).toBe(false);
    expect(parseBooleanSetting(undefined, true)).toBe(true);
    expect(parseBooleanSetting("maybe", false)).toBe(false);
    expect(serializeBooleanSetting(true)).toBe("true");
  });

  it("picks the chat commit prompt for the requested action", () => {
    expect(getManualCommitPrompt("commit")).toBe(MANUAL_COMMIT_CHAT_PROMPT);
    expect(getManualCommitPrompt("commit-push")).toBe(MANUAL_COMMIT_CHAT_PUSH_PROMPT);
  });
});
