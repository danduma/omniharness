import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { getSessionById } from "@/server/auth/session";
import type { ActiveAuthSession } from "@/server/auth/session";

const STREAM_TICKET_TTL_MS = 60_000;
const STREAM_TICKET_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const TERMINAL_STREAM_PATH = /^\/api\/terminals\/[^/]+\/stream$/;

type StreamTicketSession = Pick<
  ActiveAuthSession,
  "id" | "transport" | "clientKind" | "boundOrigin"
>;

type StreamTicketRecord = {
  sessionId: string;
  path: string;
  origin: string;
  expiresAt: number;
};

export function validateStreamTicketPath(path: string) {
  if (path === "/api/events" || TERMINAL_STREAM_PATH.test(path)) {
    return path;
  }
  throw new TypeError("Stream ticket path must identify an event or terminal stream.");
}

function ticketHash(ticket: string) {
  return createHash("sha256").update(ticket).digest("base64url");
}

export class StreamTicketManager {
  private readonly records = new Map<string, StreamTicketRecord>();
  private readonly now: () => number;
  private readonly randomBytes: () => Buffer;
  private readonly loadSession: (
    sessionId: string,
  ) => Promise<StreamTicketSession | null>;

  constructor(options: {
    now?: () => number;
    randomBytes?: () => Buffer;
    loadSession?: (sessionId: string) => Promise<StreamTicketSession | null>;
  } = {}) {
    this.now = options.now ?? Date.now;
    this.randomBytes = options.randomBytes ?? (() => nodeRandomBytes(32));
    this.loadSession = options.loadSession ?? (
      async (sessionId) => getSessionById(sessionId, { touch: false })
    );
  }

  issue(input: { sessionId: string; path: string; origin: string }) {
    const path = validateStreamTicketPath(input.path);
    const ticket = this.randomBytes().toString("base64url");
    if (!STREAM_TICKET_PATTERN.test(ticket)) {
      throw new TypeError("Stream ticket must be 43–128 base64url characters.");
    }
    const expiresAt = this.now() + STREAM_TICKET_TTL_MS;
    this.records.set(ticketHash(ticket), {
      sessionId: input.sessionId,
      path,
      origin: input.origin,
      expiresAt,
    });
    return {
      ticket,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  async redeem(input: { ticket: string; path: string; origin: string }) {
    if (!STREAM_TICKET_PATTERN.test(input.ticket)) {
      throw new Error("Stream ticket is invalid or already used.");
    }
    const key = ticketHash(input.ticket);
    const record = this.records.get(key);
    this.records.delete(key);
    if (!record) {
      throw new Error("Stream ticket is invalid or already used.");
    }
    if (record.expiresAt <= this.now()) {
      throw new Error("Stream ticket expired.");
    }
    const path = validateStreamTicketPath(input.path);
    if (record.path !== path) {
      throw new Error("Stream ticket path does not match.");
    }
    if (record.origin !== input.origin) {
      throw new Error("Stream ticket origin does not match.");
    }
    const session = await this.loadSession(record.sessionId);
    if (
      !session
      || session.transport !== "bearer"
      || session.clientKind !== "browser"
      || session.boundOrigin !== record.origin
    ) {
      throw new Error("Stream ticket session is no longer valid.");
    }
    return { session, origin: record.origin };
  }

  reset() {
    this.records.clear();
  }
}

export const streamTicketManager = new StreamTicketManager();

export async function redeemStreamTicketRequest(request: Request, path: string) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return null;
  }
  const origin = request.headers.get("origin")?.trim() ?? "";
  if (!origin) {
    return {
      response: Response.json({
        error: {
          code: "auth.stream_ticket_origin_missing",
          message: "Stream ticket requests require their bound Origin.",
        },
      }, { status: 403 }),
      origin: null,
    };
  }
  try {
    const redeemed = await streamTicketManager.redeem({ ticket, path, origin });
    return {
      response: null,
      origin: redeemed.origin,
      session: redeemed.session,
    };
  } catch (error) {
    return {
      response: Response.json({
        error: {
          code: "auth.stream_ticket_rejected",
          message: error instanceof Error ? error.message : String(error),
        },
      }, { status: 401 }),
      origin: null,
    };
  }
}

export function attachStreamTicketCors(response: Response, origin: string | null) {
  if (!origin) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  headers.delete("access-control-allow-credentials");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
