import { describe, expect, it, vi } from "vitest";
import { isRecoverableConnectionSupervisorError, isTransientSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";

describe("isTransientSupervisorError", () => {
  it("treats fetch wrapper errors with retryable network causes as transient", () => {
    const error = new TypeError(
      "fetch failed",
      { cause: Object.assign(new Error("connect ECONNREFUSED api.example.com:443"), { code: "ECONNREFUSED" }) },
    );

    expect(isTransientSupervisorError(error)).toBe(true);
  });

  it("treats timed-out runtime list requests as transient", () => {
    expect(isTransientSupervisorError(new Error("Agent runtime list request timed out after 5000ms."))).toBe(true);
  });

  it("treats wrapped DNS lookup failures from model providers as transient", () => {
    expect(isTransientSupervisorError(new Error(
      "Cannot connect to API: getaddrinfo ENOTFOUND generativelanguage.googleapis.com (caused by: getaddrinfo ENOTFOUND generativelanguage.googleapis.com)",
    ))).toBe(true);
  });

  it("treats plain-text retryable bridge failures as transient", () => {
    expect(isTransientSupervisorError(new Error("Ask failed: Agent is busy: worker-1"))).toBe(true);
    expect(isTransientSupervisorError(new Error("Get agent failed: read ECONNRESET"))).toBe(true);
    expect(isTransientSupervisorError(new Error("Cannot connect to API: connect ETIMEDOUT api.example.com"))).toBe(true);
  });

  it("identifies wrapped connection failures for unlimited connection recovery", () => {
    const reset = new TypeError(
      "fetch failed",
      { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) },
    );
    const timeout = Object.assign(new Error("connect ETIMEDOUT api.example.com:443"), { code: "ETIMEDOUT" });
    const dns = new Error("getaddrinfo EAI_AGAIN api.example.com");

    expect(isRecoverableConnectionSupervisorError(reset)).toBe(true);
    expect(isRecoverableConnectionSupervisorError(timeout)).toBe(true);
    expect(isRecoverableConnectionSupervisorError(dns)).toBe(true);
    expect(isRecoverableConnectionSupervisorError(new Error("API key not valid"))).toBe(false);
  });

  it("does not retry clear configuration errors", () => {
    expect(isTransientSupervisorError(new Error("API key not valid"))).toBe(false);
  });

  it("honors an explicit retryable override on wrapped errors", () => {
    expect(isTransientSupervisorError(Object.assign(new Error("Spawn failed: failed to start agent"), {
      status: 500,
      retryable: false,
    }))).toBe(false);
  });
});

describe("retrySupervisorRequest", () => {
  it("logs retryable failures as one useful line without dumping the error stack", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockResolvedValueOnce("ok");

    await expect(retrySupervisorRequest(operation, {
      attempts: 3,
      maxDelayMs: 15 * 60_000,
      retryIndefinitelyWhen: isRecoverableConnectionSupervisorError,
      sleep,
    })).resolves.toBe("ok");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("attempt 1"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("retrying indefinitely"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("next delay 1000ms"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("max delay 900000ms"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("TypeError: fetch failed"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("ECONNRESET: read ECONNRESET"));

    const warning = warnSpy.mock.calls[0]?.[0];
    expect(typeof warning).toBe("string");
    expect(warning).not.toContain("\n");
    expect(warnSpy.mock.calls[0]).toHaveLength(1);
    warnSpy.mockRestore();
  });

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

  it("keeps retrying ECONNRESET failures beyond the attempt limit with capped exponential backoff", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const reset = Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" });
    const operation = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockRejectedValueOnce(new TypeError("fetch failed", { cause: reset }))
      .mockResolvedValueOnce("restored");

    await expect(retrySupervisorRequest(operation, {
      attempts: 3,
      initialDelayMs: 25,
      maxDelayMs: 60,
      retryIndefinitelyWhen: isRecoverableConnectionSupervisorError,
      sleep,
    })).resolves.toBe("restored");

    expect(operation).toHaveBeenCalledTimes(5);
    expect(sleep).toHaveBeenNthCalledWith(1, 25);
    expect(sleep).toHaveBeenNthCalledWith(2, 50);
    expect(sleep).toHaveBeenNthCalledWith(3, 60);
    expect(sleep).toHaveBeenNthCalledWith(4, 60);
  });

  it("times out an operation attempt so supervisor leases are not held indefinitely", async () => {
    vi.useFakeTimers();
    const operation = vi.fn(() => new Promise<string>(() => {
      // Simulate a model/provider request that never resolves.
    }));

    const request = retrySupervisorRequest(operation, {
      attempts: 1,
      operationTimeoutMs: 75,
    });
    const expectation = expect(request).rejects.toThrow("Supervisor request timed out after 75ms");

    await vi.advanceTimersByTimeAsync(75);

    await expectation;
    expect(operation).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
