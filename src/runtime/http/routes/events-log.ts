/**
 * Read-side affordance for the chaos harness and for `gh issue`-style
 * debugging: polls the named-event ring buffer as JSON instead of
 * holding an SSE stream open.
 *
 * This endpoint is dev/test only. In production it returns 404 — no
 * production code path reaches the ring buffer through this surface.
 */
import { getNamedEventsSince } from "@/server/events/named-events";
import type { OmniHttpHandler } from "@/runtime/http/registry";

export const handleEventsLogRequest: OmniHttpHandler = (request) => {
  if (request.method !== "GET") {
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET" },
    });
  }

  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  const url = new URL(request.url);
  const sinceRaw = url.searchParams.get("since");
  const runIdRaw = url.searchParams.get("runId");

  let lastEventId: number | null = null;
  if (sinceRaw !== null && sinceRaw.trim() !== "") {
    const parsed = Number.parseInt(sinceRaw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return Response.json({ error: "invalid_since" }, { status: 400 });
    }
    lastEventId = parsed;
  }

  const result = getNamedEventsSince(lastEventId, {
    runId: runIdRaw?.trim() ? runIdRaw.trim() : null,
  });

  return Response.json({
    resyncRequired: result.resyncRequired,
    lastEventId: result.lastEventId,
    events: result.events.map((entry) => ({
      id: entry.id,
      emittedAt: entry.emittedAt,
      runId: entry.runId,
      event: entry.event,
    })),
  });
};
