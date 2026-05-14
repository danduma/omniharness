import { randomBytes } from "crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import fs from "fs";
import path from "path";
import process from "process";
import {
  authorizeRestartRequest,
  authorizeSessionCookie,
  createNodeRestartSystem,
  createRestartController,
  createSessionCookie,
  resolveRestartControlConfig,
  type RestartMode,
  restartSessionCookieName,
  verifyRestartControlPassword,
} from "../src/server/restart-control";

const repoRoot = process.cwd();
const config = resolveRestartControlConfig(repoRoot, process.env);
const tokenFile = path.join(repoRoot, ".omniharness", "remote-restart-token");

function ensureToken() {
  if (config.token) {
    return config.token;
  }

  try {
    const existing = fs.readFileSync(tokenFile, "utf8").trim();
    if (existing) {
      return existing;
    }
  } catch {
    // First run creates a local token file under ignored state.
  }

  fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
  const token = randomBytes(32).toString("hex");
  fs.writeFileSync(tokenFile, `${token}\n`, { mode: 0o600 });
  return token;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(body)}\n`);
}

function sendHtml(response: ServerResponse, statusCode: number, html: string, headers: Record<string, string> = {}) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  response.end(html);
}

function redirect(response: ServerResponse, location: string, headers: Record<string, string> = {}) {
  response.writeHead(303, {
    location,
    "cache-control": "no-store",
    ...headers,
  });
  response.end();
}

async function readFormBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

function renderShell(body: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OmniHarness Restart</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #111315;
      --panel: #191d21;
      --panel-2: #20262b;
      --text: #f4f1e8;
      --muted: #a9b0b6;
      --line: #343b42;
      --accent: #f0b35a;
      --accent-2: #8fd5c7;
      --danger: #ef6d64;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: radial-gradient(circle at 30% 10%, #263038 0, transparent 36rem), var(--bg);
      color: var(--text);
      font: 16px/1.5 ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    }
    main {
      width: min(92vw, 520px);
      border: 1px solid var(--line);
      background: linear-gradient(180deg, var(--panel), #131619);
      box-shadow: 0 24px 80px rgb(0 0 0 / 38%);
    }
    header, section, footer { padding: 24px; }
    header { border-bottom: 1px solid var(--line); }
    h1 { margin: 0; font-size: 22px; font-weight: 760; letter-spacing: 0; }
    p { margin: 8px 0 0; color: var(--muted); }
    .field { display: grid; gap: 8px; margin-top: 18px; }
    label, .label { color: var(--muted); font-size: 13px; text-transform: uppercase; }
    input {
      width: 100%;
      border: 1px solid var(--line);
      background: #0e1012;
      color: var(--text);
      padding: 13px 14px;
      font: inherit;
    }
    button {
      width: 100%;
      border: 0;
      background: var(--accent);
      color: #16110a;
      padding: 14px 16px;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }
    button.secondary {
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--text);
    }
    .grid { display: grid; gap: 12px; }
    .actions { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .metric {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      padding: 12px;
      background: #111518;
      border: 1px solid var(--line);
    }
    .metric strong { text-align: right; overflow-wrap: anywhere; }
    pre {
      max-height: 42vh;
      overflow: auto;
      margin: 0;
      padding: 14px;
      background: #090b0c;
      border: 1px solid var(--line);
      color: #d6ddd8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 12px/1.5 ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    }
    .ok { color: var(--accent-2); }
    .warn { color: var(--danger); }
    footer { border-top: 1px solid var(--line); display: grid; gap: 10px; }
    @media (max-width: 420px) {
      body { place-items: stretch; }
      main { width: 100%; min-height: 100vh; border: 0; }
      header, section, footer { padding: 20px; }
      .actions { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function renderLoginPage(error = false) {
  return renderShell(`
    <header>
      <h1>OmniHarness Restart</h1>
      <p>Remote control is locked. Sign in before touching the server.</p>
    </header>
    <section>
      ${error ? `<p class="warn">Password was not accepted.</p>` : ""}
      <form method="post" action="/login" class="grid">
        <div class="field">
          <label for="password">Password</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
        </div>
        <button type="submit">Unlock</button>
      </form>
    </section>`);
}

async function renderControlPage(status: { mode?: RestartMode; restarted?: boolean; error?: string } = {}) {
  const runtime = await controller.getStatus();
  const command = runtime.command.length > 0 ? runtime.command.join(" ") : "Not started by restart control";
  const mode = runtime.mode ?? "unknown";
  return renderShell(`
    <header>
      <h1>OmniHarness Restart</h1>
      <p class="${runtime.running ? "ok" : "warn"}">${runtime.running ? "OmniHarness appears to be running." : "No managed OmniHarness process detected."}</p>
    </header>
    <section class="grid">
      ${status.restarted ? `<p class="ok">${status.mode === "prod" ? "Production" : "Development"} start signal accepted.</p>` : ""}
      ${status.error ? `<p class="warn">${escapeHtml(status.error)}</p>` : ""}
      <div class="metric"><span class="label">Status</span><strong>${runtime.running ? "Running" : "Stopped"}</strong></div>
      <div class="metric"><span class="label">Mode</span><strong>${escapeHtml(mode)}</strong></div>
      <div class="metric"><span class="label">PID</span><strong>${runtime.pid ?? "none"}</strong></div>
      <div class="metric"><span class="label">Command</span><strong>${escapeHtml(command)}</strong></div>
      <div class="metric"><span class="label">Ports</span><strong>${config.managedPorts.join(", ")}</strong></div>
      <div class="metric"><span class="label">Listeners</span><strong>${runtime.listenerPids.length > 0 ? runtime.listenerPids.join(", ") : "none"}</strong></div>
      <div class="metric"><span class="label">Log file</span><strong>${escapeHtml(config.logFile)}</strong></div>
      <pre>${escapeHtml(runtime.recentLog || "No restart-control logs yet.")}</pre>
    </section>
    <footer>
      <div class="actions">
        <form method="post" action="/start">
          <input type="hidden" name="mode" value="dev">
          <button type="submit">Start Dev</button>
        </form>
        <form method="post" action="/start">
          <input type="hidden" name="mode" value="prod">
          <button type="submit">Start Prod</button>
        </form>
      </div>
      <form method="post" action="/logout">
        <button class="secondary" type="submit">Lock</button>
      </form>
    </footer>`);
}

const token = ensureToken();
const controller = createRestartController({
  config: { ...config, token },
  system: createNodeRestartSystem(config),
});

let activeRestart: Promise<unknown> | null = null;

function requestHasWebSession(request: IncomingMessage) {
  return authorizeSessionCookie(request.headers.cookie, token);
}

function requestCanUseApi(request: IncomingMessage) {
  return authorizeRestartRequest(request.headers, token) || requestHasWebSession(request);
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  void (async () => {
    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && url.pathname === "/") {
      if (!requestHasWebSession(request)) {
        sendHtml(response, 200, renderLoginPage(url.searchParams.get("error") === "1"));
        return;
      }
      const mode = url.searchParams.get("mode") === "prod" ? "prod" : "dev";
      sendHtml(response, 200, await renderControlPage({
        mode,
        restarted: url.searchParams.get("restarted") === "1",
      }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/login") {
      const form = await readFormBody(request);
      if (!(await verifyRestartControlPassword(process.env, token, form.get("password") ?? ""))) {
        redirect(response, "/?error=1");
        return;
      }

      redirect(response, "/", {
        "set-cookie": `${restartSessionCookieName}=${createSessionCookie(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/logout") {
      redirect(response, "/", {
        "set-cookie": `${restartSessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
      });
      return;
    }

    if (!requestCanUseApi(request)) {
      sendJson(response, 401, { ok: false, error: "unauthorized" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/status") {
      sendJson(response, 200, { ok: true, ...(await controller.getStatus()) });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/start" || url.pathname === "/restart")) {
      if (activeRestart) {
        sendJson(response, 409, { ok: false, error: "restart already in progress" });
        return;
      }

      const form = request.headers["content-type"]?.includes("application/x-www-form-urlencoded")
        ? await readFormBody(request)
        : new URLSearchParams();
      const mode: RestartMode = (form.get("mode") ?? url.searchParams.get("mode")) === "prod" ? "prod" : "dev";

      activeRestart = controller.restart("remote request", mode)
        .then((entry) => {
          if (request.headers.accept?.includes("text/html")) {
            redirect(response, `/?restarted=1&mode=${entry.mode}`);
            return;
          }
          sendJson(response, 202, { ok: true, pid: entry.pid, mode: entry.mode, startedAt: entry.startedAt });
        })
        .catch((error) => {
          sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          activeRestart = null;
        });
      return;
    }

    sendJson(response, 404, { ok: false, error: "not found" });
  })().catch((error) => {
    sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  });
});

server.listen(config.port, config.host, () => {
  process.stdout.write(`[restart-control] Listening on http://${config.host}:${config.port}\n`);
  process.stdout.write(`[restart-control] Token file: ${tokenFile}\n`);
  process.stdout.write(`[restart-control] Web password: ${process.env.OMNIHARNESS_AUTH_PASSWORD_HASH ? "from OMNIHARNESS_AUTH_PASSWORD_HASH" : process.env.OMNIHARNESS_AUTH_PASSWORD ? "from OMNIHARNESS_AUTH_PASSWORD" : process.env.OMNIHARNESS_REMOTE_RESTART_PASSWORD ? "from OMNIHARNESS_REMOTE_RESTART_PASSWORD" : "token file contents"}\n`);
  process.stdout.write(`[restart-control] Restart with: curl -X POST http://HOST:${config.port}/restart -H "Authorization: Bearer $(cat ${tokenFile})"\n`);
});
