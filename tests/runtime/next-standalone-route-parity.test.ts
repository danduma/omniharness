import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import fixture from "./fixtures/routes.v1.json";

const repositoryRoot = path.resolve(__dirname, "../..");
const children: ChildProcess[] = [];
const roots: string[] = [];

async function startAdapter(mode: "fixture" | "standalone") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `omni-parity-${mode}-`));
  roots.push(root);
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    path.join(repositoryRoot, "tests", "runtime", "parity-adapter-server.ts"),
  ], {
    cwd: repositoryRoot,
    env: {
      ...process.env,
      OMNI_PARITY_ADAPTER: mode,
      OMNIHARNESS_ROOT: root,
      OMNIHARNESS_AUTH_PASSWORD: "route-parity-password",
      OMNIHARNESS_AUTH_PASSWORD_HASH: "",
      OMNIHARNESS_TEST_BYPASS_AUTH: "",
      OMNIHARNESS_E2E_BYPASS_AUTH: "",
      NODE_ENV: "test",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  const port = await new Promise<number>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/PARITY_READY (\d+)/);
      if (match) {
        resolve(Number(match[1]));
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("exit", (code) => {
      reject(new Error(`${mode} adapter exited ${code}: ${stderr}`));
    });
  });
  return `http://127.0.0.1:${port}`;
}

function concretePath(pathname: string) {
  return pathname
    .replaceAll(":id", "missing-id")
    .replaceAll(":name", "missing-agent")
    .replaceAll(":messageId", "missing-message")
    .replaceAll(":workerId", "missing-worker");
}

function normalizeValue(
  value: unknown,
  origins: string[],
  key: string | null = null,
): unknown {
  if (
    typeof value === "number"
    && ["builtAt", "emittedAt"].includes(key ?? "")
  ) {
    return 0;
  }
  if (typeof value === "string") {
    if (key === "streamEpoch") {
      return "<epoch>";
    }
    const originNormalized = origins.reduce(
      (normalized, origin) => normalized.replaceAll(origin, "<origin>"),
      value,
    );
    return originNormalized
      .replace(/[A-Za-z0-9_-]{16,}:(\d+)/g, "<epoch>:$1")
      .replace(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
        "<uuid>",
      )
      .replace(/"builtAt":\d+/g, "\"builtAt\":0");
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, origins, null));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        normalizeValue(item, origins, key),
      ]),
    );
  }
  return value;
}

async function capture(origin: string, route: string, origins: string[]) {
  const [method, pathname] = route.split(" ", 2);
  const response = await fetch(`${origin}${concretePath(pathname!)}`, {
    method,
    headers: method === "GET" || method === "DELETE"
      ? { origin }
      : { origin, "content-type": "application/json" },
    body: method === "GET" || method === "DELETE"
      ? undefined
      : JSON.stringify({}),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Text and empty responses stay text.
  }
  return {
    status: response.status,
    headers: {
      contentType: response.headers.get("content-type"),
      setCookie: response.headers.get("set-cookie"),
    },
    body: normalizeValue(body, origins),
  };
}

async function login(origin: string) {
  const response = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      password: "route-parity-password",
      label: "Route parity",
    }),
  });
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

async function captureSseFrame(origin: string, cookie: string) {
  const abortController = new AbortController();
  const response = await fetch(`${origin}/api/events`, {
    headers: { cookie },
    signal: abortController.signal,
  });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (!text.includes("\n\n")) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  abortController.abort();
  await reader.cancel().catch(() => undefined);
  return text.slice(0, text.indexOf("\n\n") + 2);
}

let fixtureOrigin = "";
let standaloneOrigin = "";

beforeAll(async () => {
  [fixtureOrigin, standaloneOrigin] = await Promise.all([
    startAdapter("fixture"),
    startAdapter("standalone"),
  ]);
}, 45_000);

afterAll(async () => {
  await Promise.all(children.map((child) => new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  })));
  for (const root of roots) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Route fixture and standalone runner route parity", () => {
  const runnerOnly = new Set(fixture.runnerOnly);
  for (const route of fixture.routes.filter((item) => !runnerOnly.has(item))) {
    it(route, async () => {
      const origins = [fixtureOrigin, standaloneOrigin];
      const [fixtureResult, standalone] = await Promise.all([
        capture(fixtureOrigin, route, origins),
        capture(standaloneOrigin, route, origins),
      ]);
      expect(standalone).toEqual(fixtureResult);
    });
  }

  it("compares authenticated multipart upload semantics", async () => {
    const [fixtureCookie, standaloneCookie] = await Promise.all([
      login(fixtureOrigin),
      login(standaloneOrigin),
    ]);
    const upload = async (origin: string, cookie: string) => {
      const form = new FormData();
      form.append(
        "files",
        new File(["route parity"], "parity.txt", { type: "text/plain" }),
      );
      const response = await fetch(`${origin}/api/attachments`, {
        method: "POST",
        headers: { cookie, origin },
        body: form,
      });
      return {
        status: response.status,
        contentType: response.headers.get("content-type"),
        body: normalizeValue(
          await response.json(),
          [fixtureOrigin, standaloneOrigin],
        ),
      };
    };

    const [fixtureResult, standalone] = await Promise.all([
      upload(fixtureOrigin, fixtureCookie),
      upload(standaloneOrigin, standaloneCookie),
    ]);
    expect(standalone).toEqual(fixtureResult);
  });

  it("compares a bounded authenticated SSE frame and aborts both readers", async () => {
    const [fixtureCookie, standaloneCookie] = await Promise.all([
      login(fixtureOrigin),
      login(standaloneOrigin),
    ]);
    const [fixtureFrame, standaloneFrame] = await Promise.all([
      captureSseFrame(fixtureOrigin, fixtureCookie),
      captureSseFrame(standaloneOrigin, standaloneCookie),
    ]);

    expect(normalizeValue(standaloneFrame, [fixtureOrigin, standaloneOrigin]))
      .toEqual(normalizeValue(fixtureFrame, [fixtureOrigin, standaloneOrigin]));
    expect(fixtureFrame).toContain("event: update");
  });
});
