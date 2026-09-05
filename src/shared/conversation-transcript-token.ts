/**
 * Codec for the conversation transcript pagination cursor.
 *
 * `seq` is per-worker, so a merged transcript cannot page on a single
 * number. The token carries one cursor per worker, base64url-encoded JSON.
 *
 * Semantics:
 *   - As `afterToken`, `cursors[workerId]` is the highest seq the client has
 *     consumed from that worker; the server returns entries strictly newer.
 *   - As `beforeToken`, `cursors[workerId]` is the lowest seq the client
 *     holds; the server returns entries strictly older. A worker absent from
 *     the map is treated as 0, which yields nothing.
 *
 * This lives in `shared/` because the frontend also has to mint a token: when
 * the retention collector drops the head of an in-memory transcript, the
 * server's `oldestToken` no longer describes the client's window, and
 * scroll-back would skip the entries that were just dropped.
 */

export interface ConversationTranscriptToken {
  cursors: Record<string, number>;
}

function encodeUtf8ToBase64Url(text: string): string {
  const base64 = typeof Buffer !== "undefined"
    ? Buffer.from(text, "utf8").toString("base64")
    : btoa(String.fromCharCode(...new TextEncoder().encode(text)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64UrlToUtf8(raw: string): string {
  const base64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Malformed or absent tokens decode to an empty cursor map (cold start). */
export function decodeConversationTranscriptToken(raw: string | null | undefined): ConversationTranscriptToken {
  if (!raw) {
    return { cursors: {} };
  }
  try {
    const parsed = JSON.parse(decodeBase64UrlToUtf8(raw)) as ConversationTranscriptToken;
    if (parsed && typeof parsed === "object" && parsed.cursors && typeof parsed.cursors === "object") {
      const cursors: Record<string, number> = {};
      for (const [workerId, value] of Object.entries(parsed.cursors)) {
        if (typeof workerId === "string" && typeof value === "number" && Number.isFinite(value) && value >= 0) {
          cursors[workerId] = value;
        }
      }
      return { cursors };
    }
  } catch {
    // Malformed token → treat as cold start.
  }
  return { cursors: {} };
}

export function encodeConversationTranscriptToken(token: ConversationTranscriptToken): string {
  return encodeUtf8ToBase64Url(JSON.stringify(token));
}
