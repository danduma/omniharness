import { describe, expect, it, vi } from "vitest";
import { withSqliteBusyRetry } from "@/server/db/retry";

describe("withSqliteBusyRetry", () => {
  it("retries transient SQLITE_BUSY failures", async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("SQLITE_BUSY: database is locked"))
      .mockRejectedValueOnce(new Error("database is locked"))
      .mockResolvedValue("ok");

    await expect(withSqliteBusyRetry(operation, { delayMs: 1 })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-SQLite-busy failures", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("permission denied"));

    await expect(withSqliteBusyRetry(operation, { delayMs: 1 })).rejects.toThrow("permission denied");
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
