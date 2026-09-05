import type { IncomingMessage, ServerResponse } from "node:http";
import { constants as zlibConstants, createGzip, type Gzip } from "node:zlib";

type CancelStream = (reason?: unknown) => Promise<void>;

export class OpenResponseStreams {
  private readonly cancelers = new Set<CancelStream>();

  add(cancel: CancelStream) {
    this.cancelers.add(cancel);
    return () => {
      this.cancelers.delete(cancel);
    };
  }

  get size() {
    return this.cancelers.size;
  }

  async cancelAll(reason: unknown) {
    await Promise.allSettled(
      [...this.cancelers].map((cancel) => cancel(reason)),
    );
  }
}

class ClientDisconnectedError extends Error {
  constructor() {
    super("The HTTP client disconnected.");
    this.name = "ClientDisconnectedError";
  }
}

function waitForDrain(response: ServerResponse) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      response.off("drain", onDrain);
      response.off("close", onClose);
      response.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new ClientDisconnectedError());
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    response.once("drain", onDrain);
    response.once("close", onClose);
    response.once("error", onError);
  });
}

function copyHeaders(response: ServerResponse, fetchResponse: Response) {
  response.statusCode = fetchResponse.status;
  fetchResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });
}

function clientAcceptsGzip(request: IncomingMessage) {
  const header = request.headers["accept-encoding"];
  if (typeof header !== "string") {
    return false;
  }
  let gzipQuality: number | undefined;
  let wildcardQuality: number | undefined;
  for (const entry of header.split(",")) {
    const [encoding, ...parameters] = entry.trim().toLowerCase().split(";");
    if (encoding !== "gzip" && encoding !== "*") {
      continue;
    }
    const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith("q="));
    const parsedQuality = qualityParameter
      ? Number.parseFloat(qualityParameter.trim().slice(2))
      : 1;
    const quality = Number.isFinite(parsedQuality) && parsedQuality >= 0 && parsedQuality <= 1
      ? parsedQuality
      : 0;
    if (encoding === "gzip" && gzipQuality === undefined) {
      gzipQuality = quality;
    } else if (encoding === "*" && wildcardQuality === undefined) {
      wildcardQuality = quality;
    }
  }
  // An explicit gzip preference takes precedence over the wildcard.
  return (gzipQuality ?? wildcardQuality ?? 0) > 0;
}

function isCompressibleContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json")
    || normalized.includes("text/")
    || normalized.includes("javascript")
    || normalized.includes("application/xml")
    || normalized.includes("image/svg+xml");
}

function appendVaryAcceptEncoding(response: ServerResponse) {
  const current = response.getHeader("vary");
  const values = Array.isArray(current)
    ? current.flatMap((value) => String(value).split(","))
    : typeof current === "string"
      ? current.split(",")
      : [];
  if (!values.some((value) => value.trim().toLowerCase() === "accept-encoding")) {
    values.push("Accept-Encoding");
  }
  response.setHeader("vary", values.map((value) => value.trim()).filter(Boolean).join(", "));
}

async function waitForGzipDrain(gzip: Gzip) {
  if (gzip.destroyed) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      gzip.off("drain", onDrain);
      gzip.off("close", onClose);
      gzip.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      // A peer disconnect destroys gzip without an Error. Treat close as the
      // cancellation signal that releases a producer blocked on backpressure;
      // real compressor failures emit `error` and still reject below.
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    gzip.once("drain", onDrain);
    gzip.once("close", onClose);
    gzip.once("error", onError);
    if (gzip.destroyed) {
      onClose();
    }
  });
}

export async function writeFetchResponse(
  request: IncomingMessage,
  response: ServerResponse,
  fetchResponse: Response,
  openStreams: OpenResponseStreams,
) {
  copyHeaders(response, fetchResponse);

  const contentType = fetchResponse.headers.get("content-type") ?? "";
  const canNegotiateCompression = Boolean(
    !fetchResponse.headers.has("content-encoding")
    && !fetchResponse.headers.has("content-range")
    && isCompressibleContentType(contentType),
  );
  if (canNegotiateCompression) {
    appendVaryAcceptEncoding(response);
  }
  const shouldCompress = Boolean(
    fetchResponse.body
    && request.method !== "HEAD"
    && canNegotiateCompression
    && clientAcceptsGzip(request),
  );
  if (shouldCompress) {
    response.removeHeader("content-length");
    response.setHeader("content-encoding", "gzip");
  }
  if (contentType.toLowerCase().includes("text/event-stream")) {
    request.socket.setNoDelay(true);
    response.setHeader("x-accel-buffering", "no");
  }

  if (!fetchResponse.body || request.method === "HEAD") {
    response.end();
    return;
  }

  response.flushHeaders();
  const reader = fetchResponse.body.getReader();
  const gzip = shouldCompress
    ? createGzip({ flush: zlibConstants.Z_SYNC_FLUSH })
    : null;
  let completed = false;
  let cancelled = false;
  const cancel = async (reason?: unknown) => {
    if (cancelled || completed) {
      return;
    }
    cancelled = true;
    // A peer closing its socket is ordinary stream cancellation. Destroying a
    // zlib stream *with* ClientDisconnectedError emits an `error` event, which
    // can race the async iterator's listener and escape as an uncaught process
    // error. Close it without an error and carry the reason only to the web
    // stream reader, whose cancellation promise is explicitly settled.
    gzip?.destroy();
    await reader.cancel(reason).catch(() => undefined);
    if (!response.writableEnded && !response.destroyed) {
      response.end();
    }
  };
  const removeOpenStream = openStreams.add(cancel);
  const onDisconnect = () => {
    void cancel(new ClientDisconnectedError());
  };
  request.once("aborted", onDisconnect);
  response.once("close", onDisconnect);

  try {
    if (gzip) {
      const compressBody = (async () => {
        try {
          while (!cancelled) {
            const chunk = await reader.read();
            if (chunk.done) {
              completed = true;
              gzip.end();
              return;
            }
            if (!gzip.write(Buffer.from(chunk.value))) {
              await waitForGzipDrain(gzip);
            }
          }
        } catch (error) {
          gzip.destroy(error instanceof Error ? error : new Error(String(error)));
          throw error;
        }
      })();

      const writeCompressedBody = (async () => {
        for await (const chunk of gzip) {
          if (!response.write(chunk)) {
            await waitForDrain(response);
          }
        }
      })();
      // Attach rejection handlers to both halves immediately. Sequentially
      // awaiting the gzip iterator first left the producer promise temporarily
      // unobserved when disconnect and compression failures crossed.
      await Promise.all([compressBody, writeCompressedBody]);
    } else {
      while (!cancelled) {
        const chunk = await reader.read();
        if (chunk.done) {
          completed = true;
          break;
        }
        if (!response.write(Buffer.from(chunk.value))) {
          await waitForDrain(response);
        }
      }
    }
    if (!response.writableEnded && !response.destroyed) {
      response.end();
    }
  } catch (error) {
    if (!(error instanceof ClientDisconnectedError) && !response.destroyed) {
      throw error;
    }
  } finally {
    request.off("aborted", onDisconnect);
    response.off("close", onDisconnect);
    removeOpenStream();
    if (!completed && !cancelled) {
      await reader.cancel().catch(() => undefined);
    }
    reader.releaseLock();
  }
}
