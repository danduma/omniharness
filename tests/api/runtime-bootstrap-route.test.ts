import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/runtime/bootstrap/route";

describe("/api/runtime/bootstrap", () => {
  it("returns portable home bootstrap state from query params", async () => {
    const response = await GET(new NextRequest("http://localhost/api/runtime/bootstrap?run=run-1&project=%2Ftmp%2Fapp&pair=pair-1"));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.route).toEqual({
      selectedRunId: "run-1",
      draftProjectPath: "/tmp/app",
      pairTokenFromUrl: "pair-1",
    });
    expect(typeof payload.initialLastEventId).toBe("string");
    expect(payload.features.unifiedWorkerStream).toBe(true);
  });
});
