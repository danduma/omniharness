import { describe, expect, it } from "vitest";
import {
  extractQuotaResetInfo,
  normalizeQuotaResumeAt,
  parseQuotaResetText,
} from "@/server/quota/reset-parser";

const now = new Date("2026-05-10T10:00:00+08:00");

describe("quota reset parser", () => {
  it("prefers Retry-After seconds from header-like errors", () => {
    const error = Object.assign(new Error("429 quota exceeded"), {
      status: 429,
      headers: { "retry-after": "300" },
    });

    const info = extractQuotaResetInfo(error, { now });

    expect(info).toMatchObject({
      isQuotaError: true,
      source: "retry-after-header",
      confidence: "high",
      retryAfterMs: 300_000,
    });
    expect(info.resetAt?.getTime()).toBe(now.getTime() + 300_000);
  });

  it("parses Retry-After HTTP-date values", () => {
    const info = extractQuotaResetInfo({
      statusCode: 429,
      message: "quota exceeded",
      headers: new Map([["Retry-After", "Sun, 10 May 2026 11:30:00 GMT"]]),
    }, { now });

    expect(info.source).toBe("retry-after-header");
    expect(info.confidence).toBe("high");
    expect(info.resetAt?.toISOString()).toBe("2026-05-10T11:30:00.000Z");
  });

  it("parses ISO timestamps with explicit offsets", () => {
    const info = parseQuotaResetText(
      "quota exceeded until 2026-05-10T18:00:00+08:00",
      { now },
    );

    expect(info).toMatchObject({
      isQuotaError: true,
      source: "absolute-timestamp",
      confidence: "high",
    });
    expect(info.resetAt?.toISOString()).toBe("2026-05-10T10:00:00.000Z");
  });

  it("parses common date and time reset phrases", () => {
    const info = parseQuotaResetText(
      "Please try again after May 10, 2026 6:00 PM GMT+8.",
      { now },
    );

    expect(info.source).toBe("absolute-timestamp");
    expect(info.confidence).toBe("medium");
    expect(info.resetAt?.toISOString()).toBe("2026-05-10T10:00:00.000Z");
  });

  it("parses relative durations", () => {
    const info = parseQuotaResetText("try again in 4h 12m", { now });

    expect(info).toMatchObject({
      isQuotaError: true,
      source: "relative-duration",
      confidence: "high",
      retryAfterMs: 15_120_000,
    });
    expect(info.resetAt?.getTime()).toBe(now.getTime() + 15_120_000);
  });

  it("rolls time-only reset phrases to the next day when already passed", () => {
    const info = parseQuotaResetText("quota exhausted until 9:30 AM", { now });

    expect(info).toMatchObject({
      isQuotaError: true,
      source: "time-of-day",
      confidence: "medium",
    });
    expect(info.resetAt?.getFullYear()).toBe(2026);
    expect(info.resetAt?.getMonth()).toBe(4);
    expect(info.resetAt?.getDate()).toBe(11);
    expect(info.resetAt?.getHours()).toBe(9);
    expect(info.resetAt?.getMinutes()).toBe(30);
  });

  it("classifies quota text without reset as unschedulable", () => {
    const info = parseQuotaResetText("quota exceeded for this account", { now });

    expect(info).toMatchObject({
      isQuotaError: true,
      resetAt: null,
      retryAfterMs: null,
      source: "quota-without-reset",
      confidence: "low",
    });
  });

  it("does not classify generic overload 429s as quota waits", () => {
    const info = extractQuotaResetInfo(
      Object.assign(new Error("429 too many requests: server overloaded"), { status: 429 }),
      { now },
    );

    expect(info).toMatchObject({
      isQuotaError: false,
      resetAt: null,
      source: "quota-without-reset",
      confidence: "low",
    });
  });

  it("normalizes resume times with grace and max wait policy", () => {
    const schedulable = parseQuotaResetText("reset in 5 hours", { now });
    const tooLong = parseQuotaResetText("reset in 30 hours", { now });

    expect(normalizeQuotaResumeAt(schedulable, {
      now,
      quotaResetGraceMs: 1_000,
      maxQuotaWaitMs: 24 * 60 * 60_000,
    })?.getTime()).toBe(now.getTime() + 5 * 60 * 60_000 + 1_000);

    expect(normalizeQuotaResumeAt(tooLong, {
      now,
      quotaResetGraceMs: 1_000,
      maxQuotaWaitMs: 24 * 60 * 60_000,
    })).toBeNull();
  });

  it("walks nested error causes without losing reset text", () => {
    const error = Object.assign(new Error("model failed"), {
      cause: Object.assign(new Error("quota exceeded until 2026-05-10T18:00:00+08:00"), {
        statusCode: 429,
      }),
    });

    const info = extractQuotaResetInfo(error, { now });

    expect(info.isQuotaError).toBe(true);
    expect(info.source).toBe("absolute-timestamp");
    expect(info.resetAt?.toISOString()).toBe("2026-05-10T10:00:00.000Z");
  });
});
