import { describe, expect, it } from "vitest";
import { runtimeBootstrapRoute as GET } from "@/../tests/helpers/runtime-routes";

describe("/api/runtime/bootstrap", () => {
  it("returns portable home bootstrap state from query params", async () => {
    const response = await GET(new Request("http://localhost/api/runtime/bootstrap?run=run-1&project=%2Ftmp%2Fapp&pair=pair-1"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.route).toEqual({
      selectedRunId: "run-1",
      draftProjectPath: "/tmp/app",
      pairTokenFromUrl: "pair-1",
    });
    expect(typeof payload.initialLastEventId).toBe("string");
    expect(payload.features.unifiedWorkerStream).toBe(true);
    expect(payload.runner).toEqual(expect.objectContaining({
      runnerInstanceId: expect.any(String),
      name: expect.any(String),
      version: expect.any(String),
      apiRevision: {
        current: expect.any(Number),
        minimum: expect.any(Number),
      },
      capabilities: expect.arrayContaining(["unified_worker_stream"]),
      bridgeState: expect.stringMatching(/^(ready|degraded)$/),
      readinessState: expect.any(String),
      streamEpoch: expect.any(String),
    }));
    expect(payload.initialLastEventId.startsWith(`${payload.runner.streamEpoch}:`)).toBe(true);
  });
});
