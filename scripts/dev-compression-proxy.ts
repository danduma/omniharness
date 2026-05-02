import http, { type IncomingMessage, type ServerResponse } from "node:http";
import https from "node:https";
import { pipeline } from "node:stream";
import zlib from "node:zlib";

const listenHost = process.env.OMNIHARNESS_DEV_PROXY_HOST?.trim() || "127.0.0.1";
const listenPort = Number(process.env.OMNIHARNESS_DEV_PROXY_PORT || "3035");
const target = new URL(process.env.OMNIHARNESS_DEV_PROXY_TARGET || "http://127.0.0.1:3050");
const targetClient = target.protocol === "https:" ? https : http;

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function withoutHopByHopHeaders(headers: IncomingMessage["headers"]) {
  const nextHeaders = { ...headers };
  for (const header of HOP_BY_HOP_HEADERS) {
    delete nextHeaders[header];
  }
  return nextHeaders;
}

function responseHeadersForClient(proxyResponse: IncomingMessage) {
  const headers = { ...proxyResponse.headers };
  for (const header of HOP_BY_HOP_HEADERS) {
    delete headers[header];
  }
  return headers;
}

function isCompressibleContentType(contentType: string) {
  return (
    contentType.startsWith("text/")
    || contentType.includes("javascript")
    || contentType.includes("json")
    || contentType.includes("xml")
    || contentType.includes("wasm")
  );
}

function chooseEncoding(request: IncomingMessage, proxyResponse: IncomingMessage) {
  if (request.method === "HEAD" || proxyResponse.headers["content-encoding"]) {
    return null;
  }

  const statusCode = proxyResponse.statusCode ?? 500;
  if (statusCode < 200 || statusCode === 204 || statusCode === 304) {
    return null;
  }

  const contentType = String(proxyResponse.headers["content-type"] ?? "").toLowerCase();
  if (contentType.includes("text/event-stream") || !isCompressibleContentType(contentType)) {
    return null;
  }

  const acceptEncoding = String(request.headers["accept-encoding"] ?? "").toLowerCase();
  if (acceptEncoding.includes("br")) {
    return "br";
  }
  if (acceptEncoding.includes("gzip")) {
    return "gzip";
  }
  return null;
}

function addVaryAcceptEncoding(headers: http.OutgoingHttpHeaders) {
  const current = String(headers.vary ?? "").trim();
  if (!current) {
    headers.vary = "Accept-Encoding";
    return;
  }
  if (!current.toLowerCase().split(",").map((part) => part.trim()).includes("accept-encoding")) {
    headers.vary = `${current}, Accept-Encoding`;
  }
}

function isNextStaticAsset(pathname: string) {
  return pathname.startsWith("/_next/static/");
}

function proxyRequest(request: IncomingMessage, response: ServerResponse) {
  const targetUrl = new URL(request.url ?? "/", target);
  const proxyRequestOptions: http.RequestOptions = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: request.method,
    headers: {
      ...withoutHopByHopHeaders(request.headers),
      host: target.host,
      "x-forwarded-host": request.headers.host,
      "x-forwarded-proto": request.socket.encrypted ? "https" : "http",
    },
  };

  const upstream = targetClient.request(proxyRequestOptions, (proxyResponse) => {
    const encoding = chooseEncoding(request, proxyResponse);
    const headers = responseHeadersForClient(proxyResponse);

    if (isNextStaticAsset(targetUrl.pathname) && proxyResponse.statusCode !== 304) {
      headers["cache-control"] = "private, no-cache";
    }

    if (encoding) {
      delete headers["content-length"];
      headers["content-encoding"] = encoding;
      addVaryAcceptEncoding(headers);
    }

    response.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.statusMessage, headers);

    if (!encoding) {
      pipeline(proxyResponse, response, () => {});
      return;
    }

    const compressor = encoding === "br"
      ? zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        },
      })
      : zlib.createGzip({ level: 6 });
    pipeline(proxyResponse, compressor, response, () => {});
  });

  upstream.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end(`OmniHarness dev compression proxy failed: ${error instanceof Error ? error.message : String(error)}`);
  });

  pipeline(request, upstream, () => {});
}

const server = http.createServer(proxyRequest);

server.on("upgrade", (request, socket, head) => {
  const targetUrl = new URL(request.url ?? "/", target);
  const upstream = targetClient.request({
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: request.method,
    headers: {
      ...withoutHopByHopHeaders(request.headers),
      connection: "Upgrade",
      upgrade: request.headers.upgrade,
      host: target.host,
      "x-forwarded-host": request.headers.host,
      "x-forwarded-proto": "http",
    },
  });

  upstream.on("upgrade", (proxyResponse, proxySocket, proxyHead) => {
    socket.write([
      `HTTP/${proxyResponse.httpVersion} ${proxyResponse.statusCode} ${proxyResponse.statusMessage}`,
      ...Object.entries(proxyResponse.headers).flatMap(([key, value]) => {
        if (Array.isArray(value)) {
          return value.map((item) => `${key}: ${item}`);
        }
        return value === undefined ? [] : [`${key}: ${value}`];
      }),
      "",
      "",
    ].join("\r\n"));
    if (proxyHead.length > 0) {
      socket.write(proxyHead);
    }
    if (head.length > 0) {
      proxySocket.write(head);
    }
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  upstream.on("error", () => {
    socket.destroy();
  });

  upstream.end();
});

server.listen(listenPort, listenHost, () => {
  console.log(`[dev-proxy] Compressing ${target.origin} through http://${listenHost}:${listenPort}`);
});
