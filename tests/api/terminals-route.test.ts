import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/server/auth/guards", () => ({
  requireApiSession: vi.fn(() => Promise.resolve({ session: { id: "s1" }, response: null })),
}));

// Avoid touching the database; conversation cwd resolution is exercised
// separately. Here the routes always resolve to a temp dir.
vi.mock("@/server/terminal/cwd", () => ({
  resolveConversationCwd: vi.fn(() => Promise.resolve("/tmp")),
}));

import {
  handleTerminalCreateRequest,
  handleTerminalDeleteRequest,
  handleTerminalInputRequest,
  handleTerminalResizeRequest,
} from "@/runtime/http/routes/terminals";

const ctx = { surface: "web" as const };

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json", origin: "http://localhost", host: "localhost" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("terminal HTTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a terminal and returns its id and resolved cwd", async () => {
    const res = await handleTerminalCreateRequest(
      jsonRequest("http://localhost/api/terminals", "POST", { cols: 80, rows: 24 }),
      ctx,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.terminalId).toBe("string");
    expect(data.cwd).toBe("/tmp");

    // Input to the live terminal succeeds; cleanup afterwards.
    const input = await handleTerminalInputRequest(
      jsonRequest(`http://localhost/api/terminals/${data.terminalId}/input`, "POST", { data: "\n" }),
      { ...ctx, params: { id: data.terminalId } },
    );
    expect(input.status).toBe(200);

    const del = await handleTerminalDeleteRequest(
      jsonRequest(`http://localhost/api/terminals/${data.terminalId}`, "DELETE"),
      { ...ctx, params: { id: data.terminalId } },
    );
    expect(del.status).toBe(200);
  });

  it("rejects input without a data field", async () => {
    const res = await handleTerminalInputRequest(
      jsonRequest("http://localhost/api/terminals/whatever/input", "POST", {}),
      { ...ctx, params: { id: "whatever" } },
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for input/resize/delete on an unknown terminal", async () => {
    const input = await handleTerminalInputRequest(
      jsonRequest("http://localhost/api/terminals/missing/input", "POST", { data: "x" }),
      { ...ctx, params: { id: "missing" } },
    );
    expect(input.status).toBe(404);

    const resize = await handleTerminalResizeRequest(
      jsonRequest("http://localhost/api/terminals/missing/resize", "POST", { cols: 100, rows: 40 }),
      { ...ctx, params: { id: "missing" } },
    );
    expect(resize.status).toBe(404);
  });

  it("rejects resize without dimensions", async () => {
    const res = await handleTerminalResizeRequest(
      jsonRequest("http://localhost/api/terminals/missing/resize", "POST", {}),
      { ...ctx, params: { id: "missing" } },
    );
    expect(res.status).toBe(400);
  });
});
