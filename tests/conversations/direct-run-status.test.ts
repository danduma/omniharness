import { describe, expect, it } from "vitest";
import { directWorkerOutputRequestsUserInput } from "@/server/conversations/direct-run-status";

describe("directWorkerOutputRequestsUserInput", () => {
  it("does not treat quoted product copy as a request for user input", () => {
    expect(directWorkerOutputRequestsUserInput({
      currentText: "I replaced the empty-state heading with a translated \"What shall we build, Network School?\" line and the logo above it.",
    })).toBe(false);
  });

  it("detects explicit requests for user direction", () => {
    expect(directWorkerOutputRequestsUserInput({
      currentText: "Before I proceed, please confirm which approach you want.",
    })).toBe(true);
  });
});
