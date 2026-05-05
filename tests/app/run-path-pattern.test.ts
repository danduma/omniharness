import { describe, expect, it } from "vitest";
import { RUN_PATH_PATTERN } from "@/app/home/constants";

describe("RUN_PATH_PATTERN", () => {
  it("matches short session ids in direct session routes", () => {
    expect("/session/1a2b3c4d5e6f".match(RUN_PATH_PATTERN)?.[1]).toBe("1a2b3c4d5e6f");
  });

  it("keeps matching legacy UUID session routes", () => {
    expect("/session/f1dfb77c-97e2-4f6c-b5a3-75a6ccb5e7ef".match(RUN_PATH_PATTERN)?.[1])
      .toBe("f1dfb77c-97e2-4f6c-b5a3-75a6ccb5e7ef");
  });
});
