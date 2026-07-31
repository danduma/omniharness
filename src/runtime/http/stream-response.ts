import type { IncomingMessage, ServerResponse } from "node:http";

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

export async function writeFetchResponse(
  request: IncomingMessage,
  response: ServerResponse,
  fetchResponse: Response,
  openStreams: OpenResponseStreams,
) {
  copyHeaders(response, fetchResponse);

  const contentType = fetchResponse.headers.get("content-type") ?? "";
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
  let completed = false;
  let cancelled = false;
  const cancel = async (reason?: unknown) => {
    if (cancelled || completed) {
      return;
    }
    cancelled = true;
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
