import { createServer, type IncomingMessage, type ServerResponse } from "http";
import type { AgentRuntimeConfig } from "./types";
import { AgentRuntimeManager } from "./manager";
import { RuntimeHttpError } from "./types";

type EnvLike = Record<string, string | undefined>;

export type CreateAgentRuntimeServerOptions = {
  config?: AgentRuntimeConfig;
  env?: EnvLike;
};

function requestUrl(req: IncomingMessage) {
  return new URL(req.url ?? "/", "http://127.0.0.1");
}

function pathParts(req: IncomingMessage) {
  return requestUrl(req).pathname.split("/").filter(Boolean);
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function writeSse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createAgentRuntimeServer(options: CreateAgentRuntimeServerOptions = {}) {
  const manager = new AgentRuntimeManager(options);

  async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      const method = (req.method || "GET").toUpperCase();
      const parts = pathParts(req);

      if (method === "GET" && parts.length === 1 && parts[0] === "health") {
        writeJson(res, 200, { ok: true, agents: manager.agents.size });
        return;
      }

      if (method === "POST" && parts.length === 1 && parts[0] === "agents") {
        const body = await readJson(req);
        writeJson(res, 201, await manager.startAgent(body));
        return;
      }

      if (method === "GET" && parts.length === 1 && parts[0] === "agents") {
        writeJson(res, 200, manager.listAgents());
        return;
      }

      if (method === "GET" && parts.length === 1 && parts[0] === "doctor") {
        writeJson(res, 200, await manager.doctor());
        return;
      }

      if (parts.length === 2 && parts[0] === "agents" && method === "GET") {
        const agent = manager.getAgent(parts[1]);
        writeJson(res, agent ? 200 : 404, agent ?? { error: "not_found" });
        return;
      }

      if (
        parts.length === 3 &&
        parts[0] === "agents" &&
        method === "POST" &&
        (parts[2] === "approve" || parts[2] === "deny")
      ) {
        const body = await readJson(req);
        const optionId = typeof body.optionId === "string" ? body.optionId : undefined;
        const result = parts[2] === "approve"
          ? manager.approvePermission(parts[1], optionId)
          : manager.denyPermission(parts[1], optionId);
        writeJson(res, 200, result);
        return;
      }

      if (parts.length === 3 && parts[0] === "agents" && method === "POST" && parts[2] === "mode") {
        const body = await readJson(req);
        if (typeof body.mode !== "string" || body.mode.trim().length === 0) {
          writeJson(res, 400, { error: "missing 'mode' field (e.g. 'full-access', 'auto', 'read-only')" });
          return;
        }
        writeJson(res, 200, await manager.setMode(parts[1], body.mode));
        return;
      }

      if (parts.length === 3 && parts[0] === "agents" && method === "POST" && parts[2] === "cancel") {
        writeJson(res, 200, await manager.cancelAgentTurn(parts[1]));
        return;
      }

      if (parts.length === 3 && parts[0] === "agents" && method === "POST" && parts[2] === "ask") {
        const body = await readJson(req);
        if (typeof body.prompt !== "string" || body.prompt.length === 0) {
          writeJson(res, 400, { error: "prompt is required" });
          return;
        }
        const stream = requestUrl(req).searchParams.get("stream") === "true";
        if (!stream) {
          writeJson(res, 200, await manager.askAgent(parts[1], body.prompt));
          return;
        }

        res.statusCode = 200;
        res.setHeader("content-type", "text/event-stream; charset=utf-8");
        res.setHeader("cache-control", "no-cache");
        res.setHeader("connection", "keep-alive");
        res.flushHeaders();

        try {
          const result = await manager.askAgent(parts[1], body.prompt, (chunk) => {
            writeSse(res, "chunk", { chunk });
          });
          writeSse(res, "done", result);
        } catch (error) {
          if (error instanceof RuntimeHttpError) {
            writeSse(res, "error", { error: error.message, statusCode: error.statusCode });
          } else {
            writeSse(res, "error", { error: error instanceof Error ? error.message : String(error), statusCode: 500 });
          }
        } finally {
          res.end();
        }
        return;
      }

      if (parts.length === 2 && parts[0] === "agents" && method === "DELETE") {
        const ok = await manager.stopAgent(parts[1]);
        writeJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: "not_found" });
        return;
      }

      writeJson(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof RuntimeHttpError) {
        writeJson(res, error.statusCode, {
          error: error.message,
          details: error.details ?? null,
        });
        return;
      }
      writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  }

  return createServer((req, res) => {
    void handler(req, res);
  });
}
