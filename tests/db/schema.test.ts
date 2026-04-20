import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";

describe("db schema", () => {
  it("defines autonomous execution tables", () => {
    expect(schema).toHaveProperty("planItems");
    expect(schema).toHaveProperty("clarifications");
    expect(schema).toHaveProperty("validationRuns");
    expect(schema).toHaveProperty("executionEvents");
  });
});
