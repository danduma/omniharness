import { describe, expect, it, vi } from "vitest";
import { isTransientSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";

describe("isTransientSupervisorError", () => {
  it("treats fetch wrapper errors with retryable network causes as transient", () => {
    const error = new TypeError(
      "fetch failed",
      { cause: Object.assign(new Error("connect ECONNREFUSED api.example.com:443"), { code: "ECONNREFUSED" }) },
    );

    expect(isTransientSupervisorError(error)).toBe(true);
  });

  it("does not retry clear configuration errors", () => {
    expect(isTransientSupervisorError(new Error("API key not valid"))).toBe(false);
  });
});

describe("retrySupervisorRequest", () => {
  it("retries a transient failure and returns the later success", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce("ok");

    await expect(retrySupervisorRequest(operation, { attempts: 3, initialDelayMs: 25, sleep })).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(25);
  });

  it("stops immediately for non-retryable failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockRejectedValue(new Error("API key not valid"));

    await expect(retrySupervisorRequest(operation, { attempts: 3, initialDelayMs: 25, sleep })).rejects.toThrow("API key not valid");
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("throws after exhausting retries for repeated transient failures", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const operation = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    await expect(retrySupervisorRequest(operation, { attempts: 3, initialDelayMs: 25, sleep })).rejects.toThrow("fetch failed");
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 25);
    expect(sleep).toHaveBeenNthCalledWith(2, 50);
  });
});
