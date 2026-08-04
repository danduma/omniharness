import { describe, expect, it } from "vitest";
import {
  AppRequestError,
  appErrorKey,
  isAppErrorInScope,
  mergeAppErrors,
  normalizeAppError,
  parseErrorResponse,
} from "@/lib/app-errors";

describe("app error helpers", () => {
  it("normalizes structured error payloads from API responses", async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: "OmniHarness agent runtime is not running",
        source: "Agent runtime",
        action: "Load agents",
        suggestion: "Start the runtime.",
      },
    }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });

    await expect(parseErrorResponse(response)).resolves.toEqual({
      message: "OmniHarness agent runtime is not running",
      source: "Agent runtime",
      action: "Load agents",
      suggestion: "Start the runtime.",
      status: 503,
    });
  });

  it("preserves structured metadata in AppRequestError", async () => {
    const response = new Response(JSON.stringify({
      error: {
        message: "Unable to decrypt setting \"SUPERVISOR_LLM_API_KEY\".",
        source: "Settings",
        action: "Load saved settings",
      },
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
    const error = new AppRequestError(await parseErrorResponse(response));
    expect(normalizeAppError(error)).toEqual({
      message: 'Unable to decrypt setting "SUPERVISOR_LLM_API_KEY".',
      source: "Settings",
      action: "Load saved settings",
      suggestion: undefined,
      details: undefined,
      status: 500,
    });
  });

  it("carries the conversation scope through normalization", () => {
    expect(normalizeAppError(new Error("Stop worker failed"), {
      source: "Runs",
      action: "Stop worker",
      runId: "b5fef7f771eb",
    }).runId).toBe("b5fef7f771eb");

    const structured = new AppRequestError({ message: "Already stopped" });
    expect(normalizeAppError(structured, { runId: "b5fef7f771eb" }).runId).toBe("b5fef7f771eb");
  });
});

describe("conversation-scoped error visibility", () => {
  const scopedToA = { message: "Send failed", source: "Conversations", runId: "run-a" };
  const scopedToB = { message: "Send failed", source: "Conversations", runId: "run-b" };
  const global = { message: "Load saved settings failed", source: "Settings" };

  it("hides a conversation's error in every other conversation", () => {
    expect(isAppErrorInScope(scopedToA, "run-a")).toBe(true);
    expect(isAppErrorInScope(scopedToA, "run-b")).toBe(false);
    expect(isAppErrorInScope(scopedToA, null)).toBe(false);
  });

  it("keeps unscoped app-level errors visible everywhere", () => {
    expect(isAppErrorInScope(global, "run-a")).toBe(true);
    expect(isAppErrorInScope(global, null)).toBe(true);
  });

  it("does not collapse identical messages raised in different conversations", () => {
    // Without runId in the key these dedupe to one descriptor, which would then
    // render under whichever run happened to win.
    expect(appErrorKey(scopedToA)).not.toBe(appErrorKey(scopedToB));
    const merged = mergeAppErrors([], [scopedToA, scopedToB]);
    expect(merged).toHaveLength(2);
    expect(merged.filter((error) => isAppErrorInScope(error, "run-a"))).toEqual([scopedToA]);
  });
});
