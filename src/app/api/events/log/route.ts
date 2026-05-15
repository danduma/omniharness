/**
 * Read-side affordance for the chaos harness and for `gh issue`-style
 * debugging: polls the named-event ring buffer as JSON instead of
 * holding an SSE stream open.
 *
 * This endpoint is dev/test only. In production it returns 404 — no
 * production code path reaches the ring buffer through this surface.
 */
import { NextRequest, NextResponse } from "next/server";
import { getNamedEventsSince } from "@/server/events/named-events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not found", { status: 404 });
  }

  const sinceRaw = req.nextUrl.searchParams.get("since");
  const runIdRaw = req.nextUrl.searchParams.get("runId");

  let lastEventId: number | null = null;
  if (sinceRaw !== null && sinceRaw.trim() !== "") {
    const parsed = Number.parseInt(sinceRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json({ error: "invalid_since" }, { status: 400 });
    }
    lastEventId = parsed;
  }

  const result = getNamedEventsSince(lastEventId, {
    runId: runIdRaw?.trim() ? runIdRaw.trim() : null,
  });

  return NextResponse.json({
    resyncRequired: result.resyncRequired,
    lastEventId: result.lastEventId,
    events: result.events.map((entry) => ({
      id: entry.id,
      emittedAt: entry.emittedAt,
      runId: entry.runId,
      event: entry.event,
    })),
  });
}
