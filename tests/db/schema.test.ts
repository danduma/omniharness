import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";

describe("db schema", () => {
  it("defines autonomous execution tables", () => {
    expect(schema).toHaveProperty("planItems");
    expect(schema).toHaveProperty("clarifications");
    expect(schema).toHaveProperty("validationRuns");
    expect(schema).toHaveProperty("executionEvents");
  });

  it("persists durable worker terminal snapshots", () => {
    expect(schema.workers).toHaveProperty("outputEntriesJson");
    expect(schema.workers).toHaveProperty("currentText");
    expect(schema.workers).toHaveProperty("lastText");
  });
});
