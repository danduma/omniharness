import { requireApiSession } from "@/server/auth/guards";
import {
  streamTicketManager,
  validateStreamTicketPath,
} from "@/server/auth/stream-tickets";
import type { OmniHttpHandler } from "@/runtime/http/registry";

export const handleAuthStreamTicketRequest: OmniHttpHandler = async (request) => {
  const auth = await requireApiSession(request, {
    source: "Auth",
    action: "Create stream ticket",
  });
  if (auth.response) {
    return auth.response;
  }
  const origin = request.headers.get("origin")?.trim() ?? "";
  const session = auth.session;
  if (
    !session
    || session.transport !== "bearer"
    || session.clientKind !== "browser"
    || !origin
    || session.boundOrigin !== origin
  ) {
    return Response.json({
      error: {
        code: "auth.stream_ticket_session_invalid",
        message: "Stream tickets require an origin-bound browser bearer session.",
      },
    }, { status: 403 });
  }
  try {
    const body = await request.json() as { path?: unknown };
    const path = validateStreamTicketPath(
      typeof body.path === "string" ? body.path : "",
    );
    const issued = streamTicketManager.issue({
      sessionId: session.id,
      path,
      origin,
    });
    return Response.json(issued);
  } catch (error) {
    return Response.json({
      error: {
        code: "auth.stream_ticket_invalid",
        message: error instanceof Error ? error.message : String(error),
      },
    }, { status: 400 });
  }
};
