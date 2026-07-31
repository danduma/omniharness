import { describe, expect, it } from "vitest";
import { AppRequestError, normalizeAppError, parseErrorResponse } from "@/lib/app-errors";

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
});
