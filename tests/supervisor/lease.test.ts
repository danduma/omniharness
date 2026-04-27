import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";

describe("supervisor wake lease", () => {
  beforeEach(async () => {
    await db.delete(settings);
  });

  it("allows only one active lease per run until it is released", async () => {
    const { acquireSupervisorWakeLease, releaseSupervisorWakeLease } = await import("@/server/supervisor/lease");

    const firstLease = await acquireSupervisorWakeLease("run-1");
    const secondLease = await acquireSupervisorWakeLease("run-1");

    expect(firstLease).toEqual(expect.any(String));
    expect(secondLease).toBeNull();

    await releaseSupervisorWakeLease("run-1", firstLease!);

    await expect(acquireSupervisorWakeLease("run-1")).resolves.toEqual(expect.any(String));
  });
});
