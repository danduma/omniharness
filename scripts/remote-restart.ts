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
      --bg: #0b0d0f;
      --panel: #111417;
      --panel-2: #171b1f;
      --text: #f2efe7;
      --muted: #9099a2;
      --line: #262c32;
      --accent: #d7a84b;
      --ok: #73c7b7;
      --danger: #e16b61;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font: 13px/1.4 ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    }
    main {
      width: min(100%, 980px);
      height: 100vh;
      margin: 0 auto;
      background: var(--panel);
      border-inline: 1px solid var(--line);
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 14px 16px 10px;
      border-bottom: 1px solid var(--line);
    }
    h1 { margin: 0; font-size: 18px; font-weight: 760; letter-spacing: 0; }
    p { margin: 0; color: var(--muted); }
    a { color: var(--text); text-decoration-color: var(--line); }
    section { padding: 12px 16px; }
    footer { padding: 10px 16px 14px; border-top: 1px solid var(--line); }
    .subtle { color: var(--muted); }
    .field { display: grid; gap: 6px; margin-top: 12px; }
    label, .label {
      color: var(--muted);
      font-size: 11px;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    input {
      width: 100%;
      border: 1px solid var(--line);
      background: #0b0d0f;
      color: var(--text);
      padding: 10px 11px;
      font: inherit;
    }
    button, .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 34px;
      border: 1px solid var(--line);
      background: var(--panel-2);
      color: var(--text);
      padding: 8px 11px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }
    button.primary {
      background: var(--accent);
      color: #151008;
      border-color: var(--accent);
    }
    button.danger { border-color: #68403c; color: #ffb2aa; }
    button:disabled {
      cursor: not-allowed;
      color: #6f7780;
      background: #101316;
      border-color: #1b2025;
    }
    .login {
      width: min(100%, 420px);
      margin: 18vh auto 0;
      padding: 0 16px;
    }
    .login header, .login section { padding-inline: 0; border: 0; }
    .login button { width: 100%; margin-top: 10px; }
    .status-line {
      display: flex;
      gap: 16px;
      align-items: baseline;
      flex-wrap: wrap;
      padding: 10px 16px;
      border-bottom: 1px solid var(--line);
      background: #0d1012;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 2px 8px;
      border: 1px solid var(--line);
      background: #0b0d0f;
      font-weight: 760;
    }
    .pill.ok { color: var(--ok); border-color: #264a43; }
    .pill.warn { color: var(--danger); border-color: #633631; }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      border-bottom: 1px solid var(--line);
    }
    .fact {
      min-width: 0;
      padding: 10px 12px;
      border-right: 1px solid var(--line);
    }
    .fact:nth-child(4n) { border-right: 0; }
    .fact dt { margin: 0 0 4px; color: var(--muted); font-size: 11px; text-transform: uppercase; }
    .fact dd { margin: 0; font-weight: 760; overflow-wrap: anywhere; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 10px 16px;
      border-bottom: 1px solid var(--line);
    }
    .toolbar form { margin: 0; }
    .toolbar .spacer { flex: 1; }
    .notice {
      padding: 8px 16px;
      border-bottom: 1px solid var(--line);
      color: var(--ok);
      background: #101816;
    }
    .notice.warn { color: var(--danger); background: #1a1110; }
    .log-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 16px 8px;
    }
    pre {
      flex: 1;
      min-height: 0;
      max-height: none;
      overflow: auto;
      margin: 0;
      padding: 10px 16px 18px;
      background: #080a0b;
      border-top: 1px solid var(--line);
      color: #d7ddd8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 12px/1.45 ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
    }
    .ok { color: var(--ok); }
    .warn { color: var(--danger); }
    @media (max-width: 720px) {
      main { min-height: 100vh; height: auto; border: 0; }
      header { align-items: flex-start; flex-direction: column; }
      .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .fact:nth-child(2n) { border-right: 0; }
      .toolbar { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .toolbar .spacer { display: none; }
      button, .button { width: 100%; }
      pre { min-height: 52vh; flex: initial; }
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
    <div class="login">
      <header>
        <h1>OmniHarness Restart</h1>
        <span class="pill warn">locked</span>
      </header>
      <section>
        <p>Use the OmniHarness password.</p>
        ${error ? `<p class="warn">Password was not accepted.</p>` : ""}
        <form method="post" action="/login">
          <div class="field">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
          </div>
          <button class="primary" type="submit">Unlock</button>
        </form>
      </section>
    </div>`);
}

async function renderControlPage(status: { mode?: RestartMode; restarted?: boolean; stopped?: boolean; error?: string } = {}) {
  const runtime = await controller.getStatus();
  const command = runtime.command.length > 0 ? runtime.command.join(" ") : "Not started by restart control";
  const mode = runtime.mode ?? "unknown";
  const startedAt = runtime.startedAt ? new Date(runtime.startedAt).toLocaleString() : "unknown";
  const listeners = runtime.listenerPids.length > 0 ? runtime.listenerPids.join(", ") : "none";
  const appLink = "http://localhost:3035";
  const canRestartCurrent = runtime.running && runtime.mode !== null;
  const devActive = runtime.running && runtime.mode === "dev";
  const prodActive = runtime.running && runtime.mode === "prod";
  const devLabel = devActive ? "Dev Running" : runtime.running ? "Switch to Dev" : "Start Dev";
  const prodLabel = prodActive ? "Prod Running" : runtime.running ? "Switch to Prod" : "Start Prod";
  return renderShell(`
    <header>
      <h1>OmniHarness Restart</h1>
      <span class="pill ${runtime.running ? "ok" : "warn"}">${runtime.running ? "running" : "stopped"}</span>
    </header>
    <div class="status-line">
      <strong>${runtime.running ? "OmniHarness is responding on managed ports." : "No managed process detected."}</strong>
      <span class="subtle">mode ${escapeHtml(mode)}</span>
      <span class="subtle">pid ${runtime.pid ?? "none"}</span>
      <span class="subtle">started ${escapeHtml(startedAt)}</span>
    </div>
    ${status.restarted ? `<div class="notice">${status.mode === "prod" ? "Production" : "Development"} action accepted.</div>` : ""}
    ${status.stopped ? `<div class="notice warn">Stop signal accepted.</div>` : ""}
    ${status.error ? `<div class="notice warn">${escapeHtml(status.error)}</div>` : ""}
    <dl class="facts">
      <div class="fact"><dt>Command</dt><dd>${escapeHtml(command)}</dd></div>
      <div class="fact"><dt>Ports</dt><dd>${config.managedPorts.join(", ")}</dd></div>
      <div class="fact"><dt>Listeners</dt><dd>${escapeHtml(listeners)}</dd></div>
      <div class="fact"><dt>Log</dt><dd>${escapeHtml(path.basename(config.logFile))}</dd></div>
    </dl>
    <div class="toolbar">
      <form method="post" action="/restart-current">
        <button class="primary" type="submit" ${canRestartCurrent ? "" : "disabled"}>Restart Current</button>
      </form>
      <form method="post" action="/stop">
        <button class="danger" type="submit" ${runtime.running ? "" : "disabled"}>Stop</button>
      </form>
      <form method="post" action="/start">
        <input type="hidden" name="mode" value="dev">
        <button type="submit" ${devActive ? "disabled" : ""}>${devLabel}</button>
      </form>
      <form method="post" action="/start">
        <input type="hidden" name="mode" value="prod">
        <button type="submit" ${prodActive ? "disabled" : ""}>${prodLabel}</button>
      </form>
      <a class="button" href="/">Refresh</a>
      <a class="button" href="/status">JSON</a>
      <a class="button" href="${appLink}">Open App</a>
      <span class="spacer"></span>
      <form method="post" action="/logout">
        <button class="danger" type="submit">Lock</button>
      </form>
    </div>
    <div class="log-head">
      <span class="label">Recent log</span>
      <span class="subtle">${escapeHtml(config.logFile)}</span>
    </div>
    <pre id="log-viewer">${escapeHtml(runtime.recentLog || "No restart-control logs yet.")}</pre>
    <script>
      const logViewer = document.getElementById("log-viewer");
      if (logViewer) {
        requestAnimationFrame(() => {
          logViewer.scrollTop = logViewer.scrollHeight;
        });
      }
    </script>`);
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
        stopped: url.searchParams.get("stopped") === "1",
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

    if (request.method === "POST" && url.pathname === "/stop") {
      if (activeRestart) {
        sendJson(response, 409, { ok: false, error: "operation already in progress" });
        return;
      }

      activeRestart = controller.stop("remote request")
        .then(() => {
          if (request.headers.accept?.includes("text/html")) {
            redirect(response, "/?stopped=1");
            return;
          }
          sendJson(response, 202, { ok: true, stopped: true });
        })
        .catch((error) => {
          sendJson(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          activeRestart = null;
        });
      return;
    }

    if (request.method === "POST" && (url.pathname === "/restart-current" || url.pathname === "/restart/current")) {
      if (activeRestart) {
        sendJson(response, 409, { ok: false, error: "operation already in progress" });
        return;
      }

      activeRestart = controller.restartCurrent("remote request")
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

    if (request.method === "POST" && (url.pathname === "/start" || url.pathname === "/restart")) {
      if (activeRestart) {
        sendJson(response, 409, { ok: false, error: "operation already in progress" });
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
