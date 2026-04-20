import { describe, expect, it } from "vitest";
import { nextRunState } from "@/server/supervisor/runtime";

describe("nextRunState", () => {
  it("returns awaiting_user when there are pending clarifications", () => {
    expect(
      nextRunState({
        status: "analyzing",
        pendingClarifications: 2,
        unvalidatedDoneItems: 0,
        pendingItems: 3,
      }),
    ).toBe("awaiting_user");
  });

  it("returns validating when there are completed items that still need proof", () => {
    expect(
      nextRunState({
        status: "executing",
        pendingClarifications: 0,
        unvalidatedDoneItems: 1,
        pendingItems: 0,
      }),
    ).toBe("validating");
  });
});
