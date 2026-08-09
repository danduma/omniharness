---
provider: "claude"
codex_thread_id: "5d9e378d-ff6b-44ad-a39f-5ddbe539dcd9"
title: "Mac-first OmniHarness release installation patch review"
started_at: "2026-08-05T20:58:33.003Z"
updated_at: "2026-08-05T21:02:02.579Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Mac-first OmniHarness release installation patch review

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:58:33.003Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:58:33.003Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-05T20:58:33.003Z",
  "sessionId": "5d9e378d-ff6b-44ad-a39f-5ddbe539dcd9",
  "content": "You are a tool-free senior code reviewer. Do not inspect files or call tools. Review only this supplied patch.\n\nGoal: Mac-first OmniHarness release installation. ./omniharness must install deps and published ACP packages, load .env, build/serve Vite UI plus API, recommend explicit Tailscale Serve private access, and have clean Mac CI. Windows is out.\n\nConstraints: no branches/worktrees, preserve unrelated dirty changes, no silent Funnel/public access, ACP bridge stays loopback.\n\nVerification already run: 27 focused tests, typecheck, targeted eslint, Vite build, ACP 42-method check, real Tailscale dry-run, isolated live launcher health/HTML/asset 200 and clean shutdown.\n\nLook for correctness, security, destructive behavior, race/rollback bugs, false documentation claims, shell/Node portability issues, and tests that do not prove their claim. Return:\n1. Verdict READY or FIX\n2. Critical/important issues only, each with concrete fix\n3. Minor observations\n\nTRACKED DIFF:\ndiff --git a/.env.example b/.env.example\nindex 74a9ee7..548a838 100644\n--- a/.env.example\n+++ b/.env.example\n@@ -5,11 +5,12 @@\n # Prefer OMNIHARNESS_AUTH_PASSWORD_HASH if this env file may be viewed by others.\n # OMNIHARNESS_AUTH_PASSWORD_HASH=\n \n-# Optional: public or LAN origin for phone pairing and remote access links.\n-# OMNIHARNESS_PUBLIC_ORIGIN=https://example.trycloudflare.com\n+# Optional: private origin for phone pairing and remote access links.\n+# `pnpm setup:tailscale` manages this plus the loopback runner host automatically.\n+# OMNIHARNESS_PUBLIC_ORIGIN=https://your-mac.your-tailnet.ts.net\n \n # Runner/API deployment. The ACP bridge remains loopback by default.\n-# OMNIHARNESS_RUNNER_HOST=0.0.0.0\n+# OMNIHARNESS_RUNNER_HOST=127.0.0.1\n # OMNIHARNESS_RUNNER_PORT=3050\n # OMNIHARNESS_BRIDGE_URL=http://127.0.0.1:7800\n # OMNIHARNESS_MANAGE_BRIDGE=1\n@@ -42,12 +43,10 @@\n # ANTHROPIC_API_KEY=\n # GEMINI_API_KEY=\n \n-# Optional: avoid compiling codex-acp with host Rust. Auto downloads a prebuilt binary.\n-# Windows PowerShell users can set OMNIHARNESS_CODEX_ACP_INSTALL_DIR to a user bin directory.\n+# Optional Codex ACP package locations. Auto installs the maintained published\n+# npm adapter and the matching published Codex binary; it does not compile ACP.\n # OMNIHARNESS_CODEX_ACP_INSTALL=auto\n-# OMNIHARNESS_CODEX_ACP_RELEASE_REPO=danduma/omniharness\n-# OMNIHARNESS_CODEX_ACP_RELEASE_TAG=codex-acp-latest\n-# OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL=https://github.com/danduma/omniharness/releases/download/codex-acp-latest\n+# OMNIHARNESS_CODEX_ACP_NPM_ROOT=/Users/you/.local/share/omniharness/codex-acp\n # OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/Users/you/.local/bin\n # Optional fallback: run codex-acp through Docker or Podman instead.\n # OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE=omniharness/codex-acp:local\ndiff --git a/README.md b/README.md\nindex 97b467b..a259fa1 100644\n--- a/README.md\n+++ b/README.md\n@@ -25,31 +25,23 @@ OmniHarness is early open-source software under active development. Expect sharp\n \n ## Requirements\n \n-- macOS, Linux, or Windows with a normal developer shell. On Windows, use PowerShell for the setup commands below.\n-- Node.js 22.13 or newer, up to but not including Node.js 26. If you use `nvm`, run `nvm use` from the repo root to select the recommended local version.\n-- pnpm 9 or newer. The `packageManager` field in `package.json` is a known-good Corepack default, not an exact-version requirement.\n+- macOS with `git`, `curl`, and a normal Terminal shell. This is the release-gated installation path. Linux uses the same shell launcher but is not a release gate yet.\n+- Node.js 22.13 or newer, up to but not including Node.js 26. The launcher selects the repo version through `nvm` and installs `nvm` when necessary.\n+- pnpm 9 or newer. The launcher uses an existing compatible pnpm, Corepack, or npm to install the repo's known-good version.\n - `ripgrep` (`rg`) is recommended for fast agent repository search. The `./omniharness` launcher installs it automatically when a supported system package manager is available. Set `OMNIHARNESS_SKIP_RECOMMENDED_TOOLS=1` to skip recommended tool setup.\n - At least one supported coding agent when you want to run real workers:\n-  - Codex CLI plus `codex-acp`\n+  - Codex; the launcher installs the maintained ACP adapter and Codex CLI as published packages\n   - Claude CLI plus `claude-agent-acp`\n   - Gemini CLI with native ACP mode\n   - OpenCode with native ACP mode\n-- Docker, if you want OmniHarness to run `codex-acp` from a container instead\n-  of compiling the Rust adapter on the host.\n \n ## Quick Start\n \n-Clone the repo, enter it, and select the recommended Node version:\n+Clone the repo and start it:\n \n ```bash\n-git clone <repo-url> omniharness\n+git clone https://github.com/danduma/omniharness.git\n cd omniharness\n-nvm use\n-```\n-\n-Start OmniHarness normally:\n-\n-```bash\n ./omniharness\n ```\n \n@@ -62,12 +54,16 @@ The launcher opens [http://localhost:3050](http://localhost:3050) when the local\n server is ready. Set `OMNIHARNESS_OPEN_BROWSER=0` if you do not want it to open a\n browser automatically.\n \n-`./omniharness` installs dependencies when needed, builds the static interface\n-when needed, then starts the two processes in one logical runner deployment:\n+`./omniharness` checks Node and pnpm, installs repository dependencies, installs\n+or refreshes published ACP packages, and builds the Vite interface when its\n+content fingerprint changes. It then starts one logical runner deployment:\n \n-- the API/SSE server and static interface on `http://localhost:3050`\n+- the API/SSE server and production web interface together on `http://localhost:3050`\n - the co-located ACP bridge on `http://127.0.0.1:7800`\n \n+There is no separate production UI server to install or expose. The separate\n+Vite process is only for development.\n+\n Start the runner directly with `pnpm runner`. Use `--no-static` for a supported\n API-only deployment, or `--static-dir <path>` for an explicit interface\n artifact.\n@@ -91,47 +87,6 @@ Operational and security details:\n - [Authentication, sessions, credential storage, identity, and TLS](docs/security/authentication-and-tls.md)\n - [Desktop/editor migration, mobile/PWA limits, and v1 non-goals](docs/platforms/client-migration-and-limits.md)\n \n-### Windows Quick Start\n-\n-Use PowerShell from the repo root. If Corepack can write to your Node.js\n-installation, enable the repo's package manager normally:\n-\n-```powershell\n-corepack enable\n-corepack prepare pnpm@11.2.2 --activate\n-```\n-\n-If Corepack fails with an `EPERM` error under `C:\\Program Files\\nodejs`, install\n-pnpm into the user npm prefix instead:\n-\n-```powershell\n-$prefix = Join-Path $env:APPDATA \"npm\"\n-New-Item -ItemType Directory -Force -Path $prefix | Out-Null\n-npm config set prefix $prefix\n-$env:Path = \"$prefix;$env:Path\"\n-[Environment]::SetEnvironmentVariable(\"Path\", \"$prefix;$([Environment]::GetEnvironmentVariable(\"Path\", \"User\"))\", \"User\")\n-npm install -g pnpm@11.2.2\n-```\n-\n-Then clone, install, build, and start:\n-\n-```powershell\n-git clone <repo-url> omniharness\n-cd omniharness\n-pnpm install\n-Copy-Item .env.example .env\n-# Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH in .env.\n-pnpm build\n-$env:OMNIHARNESS_OPEN_BROWSER = \"0\"\n-pnpm start\n-```\n-\n-The web UI listens on `http://localhost:3050` and the runtime listens on\n-`http://127.0.0.1:7800`. For browser access from another machine, allow inbound\n-TCP traffic to the web port in Windows Firewall and in any provider firewall, or\n-put OmniHarness behind a tunnel or reverse proxy. Do not expose the runtime port\n-directly to the public internet.\n-\n Run the separate restart control app if you want a small remote escape hatch\n with its own password-gated interface:\n \n@@ -166,8 +121,8 @@ curl -X POST \"http://HOST:3099/restart?mode=dev\" \\\n \n Use `mode=prod` to launch `./omniharness` instead of `pnpm run dev`.\n \n-For phone access through Cloudflare Tunnel, expose the restart app as a second\n-hostname that points to `http://localhost:3099`, for example:\n+For public access through Cloudflare Tunnel, expose the restart app as a second\n+hostname only if you intentionally want that public-tunnel deployment:\n \n ```yaml\n ingress:\n@@ -227,24 +182,60 @@ pnpm auth:password verify \"new-password\"\n Hash-only passwords cannot be printed back out. If `status` says the password is\n hash-only and you do not know it, run `pnpm auth:password set` to replace it.\n \n-## Remote Tunnel\n+## Private Access With Tailscale\n \n-For phone or remote-browser access, expose only the web UI port through your\n-tunnel provider. With Cloudflare Tunnel quick tunnels:\n+Tailscale Serve is the recommended way to reach OmniHarness from another Mac,\n+phone, or tablet. It keeps the service inside your tailnet, applies your\n+Tailscale access rules, and provides a private HTTPS URL. Install the recommended\n+standalone [Tailscale app for macOS](https://tailscale.com/download/mac), sign in,\n+and then run:\n \n ```bash\n-cloudflared tunnel --url http://localhost:3050\n+pnpm setup:tailscale\n ```\n \n-Copy the generated `https://...` URL into `.env` and restart OmniHarness:\n+The command verifies the tailnet connection, refuses to overwrite an existing\n+LAN or tunnel configuration, configures:\n+\n+```bash\n+tailscale serve --bg http://127.0.0.1:3050\n+```\n+\n+It then writes the private `https://...ts.net` origin and loopback bind address\n+to the ignored local `.env`. Restart OmniHarness afterward:\n \n ```bash\n-printf 'OMNIHARNESS_PUBLIC_ORIGIN=%s\\n' 'https://your-tunnel-url' >> .env\n ./omniharness\n ```\n \n-Keep OmniHarness password auth enabled even when your tunnel provider also has\n-its own access controls.\n+Check the real private route with `tailscale serve status`, then open the printed\n+URL from another device on the tailnet. Password authentication remains required;\n+tailnet membership is an additional security boundary, not a replacement.\n+\n+Useful safe operations:\n+\n+```bash\n+pnpm setup:tailscale -- --dry-run  # inspect without changing Tailscale or .env\n+pnpm setup:tailscale -- --force    # preserve conflicting values as comments, then replace them\n+pnpm setup:tailscale -- --reset    # disable OmniHarness HTTPS Serve and remove managed settings\n+```\n+\n+If Serve reports an operator, administrator, MagicDNS, or HTTPS-certificate\n+problem, follow the exact Tailscale error and retry. The setup command leaves\n+`.env` unchanged when Serve fails.\n+\n+### Optional Public Access With Cloudflare\n+\n+Use a public tunnel only when tailnet-only access is not sufficient. Expose port\n+`3050`, never the ACP bridge on `7800`:\n+\n+```bash\n+cloudflared tunnel --url http://localhost:3050\n+```\n+\n+Set `OMNIHARNESS_PUBLIC_ORIGIN` in `.env` to the generated HTTPS URL and restart\n+OmniHarness. Keep OmniHarness password authentication enabled even when the\n+tunnel provider has separate access controls.\n \n The launcher does not require a global `omniharness` install. Run the app from\n the checkout with `./omniharness`, and run CLI conversations from the checkout\n@@ -264,47 +255,33 @@ scripts/install-agent-acp.sh\n ```\n \n The setup script detects supported local coding agents and installs or refreshes\n-the ACP adapters they need. Codex uses a prebuilt `codex-acp` binary by default\n-for macOS/Linux on arm64/x64 and Windows x64. Claude's adapter is installed from npm, while\n-Gemini and OpenCode expose native ACP commands and do not need separate adapter\n-installs. The setup script also checks common agent tools including `rg`, `git`,\n-`node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`,\n-`uv`, `fd`, and `make`.\n+the ACP adapters they need. Codex uses the maintained\n+`@agentclientprotocol/codex-acp` package plus the current `@openai/codex`\n+package. The Codex package selects its published macOS binary for the current\n+CPU; the user does not compile an ACP adapter. Claude's adapter is installed from\n+npm, while Gemini and OpenCode expose native ACP commands and need no separate\n+adapter. The setup script also checks common agent tools.\n \n-### Prebuilt Codex ACP\n+### Codex ACP Updates\n \n-OmniHarness avoids compiling `codex-acp` with host Rust by default. In `auto`\n-mode, the installer downloads the matching release asset:\n+Normal `./omniharness` startup checks the managed Codex ACP and Codex CLI package\n+versions and rolls both forward when npm publishes an update. Force an immediate\n+refresh with:\n \n-```text\n-codex-acp-darwin-arm64\n-codex-acp-darwin-x64\n-codex-acp-linux-arm64\n-codex-acp-linux-x64\n-codex-acp-windows-x64.exe\n+```bash\n+scripts/install-agent-acp.sh --codex-acp=npm\n ```\n \n Useful overrides:\n \n ```bash\n-OMNIHARNESS_CODEX_ACP_INSTALL=binary\n-OMNIHARNESS_CODEX_ACP_RELEASE_REPO=danduma/omniharness\n-OMNIHARNESS_CODEX_ACP_RELEASE_TAG=codex-acp-latest\n-OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL=https://github.com/danduma/omniharness/releases/download/codex-acp-latest\n+OMNIHARNESS_CODEX_ACP_INSTALL=npm\n+OMNIHARNESS_CODEX_ACP_NPM_ROOT=/custom/package/root\n OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin\n ```\n \n-On Windows, use the PowerShell installer to download `codex-acp.exe` into\n-`%LOCALAPPDATA%\\OmniHarness\\bin`:\n-\n-```powershell\n-powershell -ExecutionPolicy Bypass -File scripts\\install-agent-acp.ps1 -AddToPath\n-```\n-\n-Git Bash/MSYS users can also run `scripts/install-agent-acp.sh`; it installs\n-the Windows release asset as `codex-acp.exe`.\n-\n-For local development against the Rust source, force Cargo mode:\n+Cargo mode remains an explicit adapter-development override and is never used by\n+normal installation:\n \n ```bash\n scripts/install-agent-acp.sh --codex-acp=cargo\n@@ -312,8 +289,7 @@ scripts/install-agent-acp.sh --codex-acp=cargo\n \n ### Docker-backed Codex ACP\n \n-If the prebuilt binary cannot run on a machine, install a Docker-backed wrapper\n-instead:\n+If you deliberately want ACP isolation, install a Docker-backed wrapper instead:\n \n ```bash\n OMNIHARNESS_CODEX_ACP_INSTALL=docker ./omniharness\n@@ -499,13 +475,10 @@ The command must print JSON:\n - **Unsupported pnpm version:** install pnpm 9 or newer, or run `./omniharness` from the repo root so the launcher can use Corepack's known-good default when available.\n - **Unsupported Node version:** use Node.js 22.13 or newer, but below Node.js 26. If you already installed dependencies with a different Node version, run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp`.\n - **Native SQLite binding errors:** run `pnpm rebuild better-sqlite3` under your current supported Node version.\n-- **Windows Corepack `EPERM` under `C:\\Program Files\\nodejs`:** install pnpm into the user npm prefix with the PowerShell commands in Windows Quick Start, then open a new shell or update `$env:Path` for the current one.\n-- **Windows install fails with `'cp' is not recognized` while building `@danduma/i18n`:** update to a checkout that pins `@danduma/i18n` to the Windows-compatible commit in `package.json`, then rerun `pnpm install`.\n - **`ERR_PNPM_IGNORED_BUILDS` mentions `node-pty`:** current checkouts allow the `node-pty` build in `pnpm-workspace.yaml`. If you are upgrading an older checkout, make sure `allowBuilds.node-pty` is `true`, then rerun `pnpm install`; use `pnpm approve-builds node-pty` only if pnpm still reports the build as pending approval.\n-- **Windows startup fails with `spawn pnpm ENOENT` or `spawn EINVAL`:** update to a checkout that runs pnpm through the Windows command shell from the start scripts. As a temporary workaround, start `pnpm runner` and `pnpm dev:interface` from separate PowerShell windows.\n - **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.\n - **Port already in use:** stop the previous OmniHarness process, or set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT` before starting.\n-- **`http://HOST:3050` times out from another machine:** confirm OmniHarness is listening on `0.0.0.0`, then allow inbound TCP traffic to that port in Windows Firewall and any hosting-provider firewall. Local `http://localhost:3050` can work even when external access is blocked.\n+- **The private Tailscale URL times out:** run `tailscale status` and `tailscale serve status`, confirm the client device is in the same tailnet and permitted by its access rules, then restart `./omniharness` after setup.\n - **Phone pairing asks for auth:** set `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH` in `.env` and restart.\n \n ## Repository Layout\ndiff --git a/docs/deployment/runner-operations.md b/docs/deployment/runner-operations.md\nindex 833fd54..fca7369 100644\n--- a/docs/deployment/runner-operations.md\n+++ b/docs/deployment/runner-operations.md\n@@ -80,6 +80,30 @@ The SQLite database and worker JSONL files are one consistency domain. Do not\n point two live runners at the same instance root. A second process refuses an\n owned runner lock. Separate instances need separate API ports and bridge URLs.\n \n+## Private access with Tailscale\n+\n+Tailscale Serve is the preferred remote-access boundary for a Mac runner. From\n+the repository root, run:\n+\n+```bash\n+pnpm setup:tailscale\n+```\n+\n+The setup command validates the connected tailnet, configures persistent private\n+HTTPS proxying to `http://127.0.0.1:3050`, and manages only these ignored `.env`\n+settings:\n+\n+```text\n+OMNIHARNESS_PUBLIC_ORIGIN=https://device.tailnet.ts.net\n+OMNIHARNESS_RUNNER_HOST=127.0.0.1\n+```\n+\n+Restart `./omniharness`, check `tailscale serve status`, and open the printed URL\n+from an allowed tailnet device. Use `pnpm setup:tailscale -- --dry-run` to inspect\n+the operation, `--force` to preserve and replace conflicting origin/host values,\n+or `--reset` to disable the owned HTTPS listener and remove its managed settings.\n+The command never enables Funnel and never proxies port `7800`.\n+\n ## TLS and reverse proxies\n \n The Node runner currently terminates HTTP. For any non-loopback deployment,\ndiff --git a/docs/security/authentication-and-tls.md b/docs/security/authentication-and-tls.md\nindex b76575b..c8dc56f 100644\n--- a/docs/security/authentication-and-tls.md\n+++ b/docs/security/authentication-and-tls.md\n@@ -85,6 +85,18 @@ Browser/PWA clients rely on browser/OS certificate trust and cannot override a\n certificate warning from JavaScript. VS Code relies on the extension host's\n standard TLS trust.\n \n+## Tailscale trust boundary\n+\n+Tailscale Serve is the preferred private HTTPS path for a Mac runner. Tailscale\n+owns device identity, tailnet membership, access rules, MagicDNS, certificates,\n+and Serve configuration. OmniHarness owns its password, sessions, public-origin\n+setting, and loopback runner bind address.\n+\n+Tailnet access is defense in depth, not authentication for OmniHarness. Keep the\n+OmniHarness password enabled, grant tailnet access narrowly, and never expose the\n+ACP bridge on port `7800`. `pnpm setup:tailscale` uses Serve only; it never enables\n+the public Tailscale Funnel feature.\n+\n ## Trusted proxies and CORS\n \n Forwarded client/protocol headers are accepted only from\ndiff --git a/omniharness b/omniharness\nindex da6ad4a..92b2df4 100755\n--- a/omniharness\n+++ b/omniharness\n@@ -160,7 +160,11 @@ else\n   echo \"[omniharness] Using pnpm ${CURRENT_PNPM_VERSION:-unknown} (minimum supported major: $MIN_PNPM_MAJOR; known-good default: $PNPM_VERSION).\"\n fi\n \n-if [ ! -d \"$ROOT_DIR/node_modules\" ] || [ ! -f \"$ROOT_DIR/node_modules/.modules.yaml\" ] || [ ! -d \"$ROOT_DIR/node_modules/.pnpm\" ]; then\n+if [ ! -d \"$ROOT_DIR/node_modules\" ] \\\n+  || [ ! -f \"$ROOT_DIR/node_modules/.modules.yaml\" ] \\\n+  || [ ! -d \"$ROOT_DIR/node_modules/.pnpm\" ] \\\n+  || [ ! -f \"$ROOT_DIR/node_modules/.pnpm/lock.yaml\" ] \\\n+  || ! cmp -s \"$ROOT_DIR/pnpm-lock.yaml\" \"$ROOT_DIR/node_modules/.pnpm/lock.yaml\"; then\n   echo \"[omniharness] Installing dependencies with $PACKAGE_MANAGER...\"\n   env pnpm_config_dangerously_allow_all_builds=true \"${PNPM_CMD[@]}\" install\n fi\n@@ -175,7 +179,7 @@ if [ \"${OMNIHARNESS_SKIP_AGENT_ACP_SETUP:-0}\" != \"1\" ]; then\n   ./scripts/install-agent-acp.sh --ensure-only || echo \"[omniharness] Agent ACP adapter setup reported issues; continuing.\" >&2\n fi\n \n-WEB_PORT=\"${PORT:-3050}\"\n+WEB_PORT=\"${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}\"\n LOCAL_URL=\"http://localhost:${WEB_PORT}\"\n \n local_omniharness_status() {\n@@ -262,12 +266,10 @@ NODE\n }\n \n print_tunnel_guidance() {\n-  echo \"[omniharness] Remote/tunnel setup:\"\n-  echo \"  1. Expose only the web UI port, for example:\"\n-  echo \"     cloudflared tunnel --url http://localhost:${WEB_PORT}\"\n-  echo \"  2. Copy the generated https://... URL into .env:\"\n-  echo \"     OMNIHARNESS_PUBLIC_ORIGIN=https://your-tunnel-url\"\n-  echo \"  3. Restart ./omniharness so pairing links and public URLs use the tunnel.\"\n+  echo \"[omniharness] Private remote access (recommended):\"\n+  echo \"  pnpm setup:tailscale\"\n+  echo \"  This exposes only the web/API port to devices allowed by your tailnet.\"\n+  echo \"[omniharness] Public internet access (optional): see the Cloudflare section in README.md.\"\n }\n \n print_start_guidance() {\n@@ -308,27 +310,17 @@ if [ \"$CURRENT_STATUS\" = \"configuration_error\" ]; then\n   exit 1\n fi\n \n-# A production `next start` needs a complete production build in .next. Running\n-# `pnpm dev` (next dev --turbo) writes dev-shaped manifests into the same .next\n-# directory, leaving BUILD_ID intact but clobbering routes-manifest.json so it\n-# lacks `dataRoutes` -> `next start` then crashes with\n-# \"routesManifest.dataRoutes is not iterable\". So validate the manifest, not just\n-# the presence of BUILD_ID, before deciding whether to skip the build.\n-needs_production_build() {\n-  [ -f \"$ROOT_DIR/.next/BUILD_ID\" ] || return 0\n-  node --input-type=module -e '\n-    import { readFileSync } from \"node:fs\";\n-    try {\n-      const m = JSON.parse(readFileSync(process.argv[1], \"utf8\"));\n-      process.exit(Array.isArray(m.dataRoutes) ? 0 : 1);\n-    } catch { process.exit(1); }\n-  ' \"$ROOT_DIR/.next/routes-manifest.json\" || return 0\n-  return 1\n-}\n-\n-if needs_production_build; then\n-  echo \"[omniharness] Building production server...\"\n+if node ./scripts/interface-build-state.mjs --check; then\n+  :\n+else\n+  BUILD_STATE_EXIT=$?\n+  if [ \"$BUILD_STATE_EXIT\" -ne 10 ]; then\n+    echo \"[omniharness] Could not inspect the production interface build.\" >&2\n+    exit \"$BUILD_STATE_EXIT\"\n+  fi\n+  echo \"[omniharness] Building production interface...\"\n   \"${PNPM_CMD[@]}\" build\n+  node ./scripts/interface-build-state.mjs --write\n fi\n \n print_start_guidance\ndiff --git a/package.json b/package.json\nindex 45215a3..81c4e1a 100644\n--- a/package.json\n+++ b/package.json\n@@ -18,15 +18,16 @@\n     \"predev\": \"node ./scripts/check-pnpm.mjs --verify-native\",\n     \"dev\": \"pnpm exec tsx scripts/dev.ts\",\n     \"dev:interface\": \"vite --config apps/interface/vite.config.ts --mode web\",\n-    \"runner\": \"node --import tsx scripts/runner.ts\",\n+    \"runner\": \"node --env-file-if-exists=.env --import tsx scripts/runner.ts\",\n     \"auth:password\": \"node ./scripts/auth-password.mjs\",\n     \"restart:control\": \"pnpm exec tsx scripts/remote-restart.ts\",\n     \"prebuild\": \"node ./scripts/check-pnpm.mjs --verify-native\",\n     \"setup:agents\": \"./scripts/install-agent-acp.sh\",\n+    \"setup:tailscale\": \"node ./scripts/setup-tailscale.mjs\",\n     \"build\": \"pnpm build:interface:web\",\n     \"build:interface:web\": \"vite build --config apps/interface/vite.config.ts --mode web\",\n     \"build:interface:packaged\": \"vite build --config apps/interface/vite.config.ts --mode packaged\",\n-    \"start\": \"node --import tsx scripts/runner.ts\",\n+    \"start\": \"node --env-file-if-exists=.env --import tsx scripts/runner.ts\",\n     \"lint\": \"eslint\",\n     \"typecheck\": \"tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.runner.json --noEmit && tsc -p tsconfig.interface.json --noEmit && tsc --noEmit\",\n     \"test\": \"vitest run\",\ndiff --git a/scripts/runner.ts b/scripts/runner.ts\nindex 7d95eb4..f428066 100644\n--- a/scripts/runner.ts\n+++ b/scripts/runner.ts\n@@ -2,9 +2,27 @@\n import fs from \"node:fs\";\n import { resolveRunnerConfig } from \"../src/server/runner/config\";\n \n+const RUNNER_HELP = `Usage: pnpm runner -- [options]\n+\n+Options:\n+  --host <address>               API and interface bind address (default: 0.0.0.0)\n+  --port <0-65535>               API and interface port (default: 3050)\n+  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)\n+  --static-dir <directory>       Serve an explicit built interface directory\n+  --no-static                    Start the API without a production interface\n+  --interface-dev-url <url>      Proxy interface requests to a Vite development server\n+  -h, --help                     Show this help\n+`;\n+\n async function main() {\n+  const rawArgv = process.argv.slice(2);\n+  const argv = rawArgv[0] === \"--\" ? rawArgv.slice(1) : rawArgv;\n+  if (argv.length === 1 && [\"--help\", \"-h\"].includes(argv[0])) {\n+    process.stdout.write(RUNNER_HELP);\n+    return;\n+  }\n   const config = resolveRunnerConfig({\n-    argv: process.argv.slice(2),\n+    argv,\n     cwd: process.cwd(),\n     env: process.env,\n   });\ndiff --git a/tests/scripts/omniharness-launcher.test.ts b/tests/scripts/omniharness-launcher.test.ts\nindex 5230cba..83cbc4b 100644\n--- a/tests/scripts/omniharness-launcher.test.ts\n+++ b/tests/scripts/omniharness-launcher.test.ts\n@@ -3,6 +3,9 @@ import path from \"node:path\";\n import { describe, expect, it } from \"vitest\";\n \n const launcherSource = readFileSync(path.resolve(process.cwd(), \"omniharness\"), \"utf8\");\n+const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), \"package.json\"), \"utf8\")) as {\n+  scripts: Record<string, string>;\n+};\n \n describe(\"omniharness launcher\", () => {\n   it(\"passes pnpm's package-manager mismatch policy through nested git dependency installs\", () => {\n@@ -19,4 +22,31 @@ describe(\"omniharness launcher\", () => {\n     expect(launcherSource).toContain(\"trap 'print_auth_password_notice; cleanup_auth_password_notice' EXIT\");\n     expect(launcherSource).toContain(\"print_start_guidance\\nprint_auth_password_notice\\nopen_browser_when_ready\");\n   });\n+\n+  it(\"loads the ignored local env file before resolving runner configuration\", () => {\n+    expect(packageJson.scripts.runner).toContain(\"--env-file-if-exists=.env\");\n+    expect(packageJson.scripts.start).toContain(\"--env-file-if-exists=.env\");\n+  });\n+\n+  it(\"reinstalls dependencies when the repository lockfile changed\", () => {\n+    expect(launcherSource).toContain('cmp -s \"$ROOT_DIR/pnpm-lock.yaml\" \"$ROOT_DIR/node_modules/.pnpm/lock.yaml\"');\n+  });\n+\n+  it(\"uses the Vite interface build marker instead of the removed Next build\", () => {\n+    expect(launcherSource).toContain(\"scripts/interface-build-state.mjs --check\");\n+    expect(launcherSource).toContain(\"scripts/interface-build-state.mjs --write\");\n+    expect(launcherSource).not.toContain(\".next/BUILD_ID\");\n+    expect(launcherSource).not.toContain(\".next/routes-manifest.json\");\n+  });\n+\n+  it(\"recommends private Tailscale access before public tunnels\", () => {\n+    const tailscaleIndex = launcherSource.indexOf(\"pnpm setup:tailscale\");\n+    const publicTunnelIndex = launcherSource.indexOf(\"Public internet access\");\n+    expect(tailscaleIndex).toBeGreaterThan(-1);\n+    expect(publicTunnelIndex).toBeGreaterThan(tailscaleIndex);\n+  });\n+\n+  it(\"uses the same configured web port for readiness, browser, and runner startup\", () => {\n+    expect(launcherSource).toContain('WEB_PORT=\"${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}\"');\n+  });\n });\n\n\n--- NEW FILE scripts/interface-build-state.mjs ---\n#!/usr/bin/env node\n\nimport { createHash } from \"node:crypto\";\nimport fs from \"node:fs/promises\";\nimport path from \"node:path\";\n\nconst MARKER_VERSION = 1;\nconst BUILD_REQUIRED_EXIT = 10;\nconst INPUT_PATHS = [\n  \"package.json\",\n  \"pnpm-lock.yaml\",\n  \"tsconfig.json\",\n  \"tsconfig.interface.json\",\n  \"tsconfig.shared.json\",\n  \"apps/interface\",\n  \"shared/locales\",\n  \"src/components\",\n  \"src/interface\",\n  \"src/lib\",\n  \"src/runtime-api\",\n  \"src/shared\",\n  \"src/ui\",\n];\n\nfunction readArgs(argv) {\n  let mode = null;\n  let root = process.cwd();\n  for (let index = 0; index < argv.length; index += 1) {\n    const arg = argv[index];\n    if (arg === \"--check\" || arg === \"--write\") {\n      if (mode) throw new TypeError(\"Use exactly one of --check or --write.\");\n      mode = arg;\n      continue;\n    }\n    if (arg === \"--root\") {\n      const value = argv[index + 1];\n      if (!value) throw new TypeError(\"--root requires a directory.\");\n      root = path.resolve(value);\n      index += 1;\n      continue;\n    }\n    throw new TypeError(`Unknown interface build-state option: ${arg}`);\n  }\n  if (!mode) throw new TypeError(\"Use --check or --write.\");\n  return { mode, root };\n}\n\nasync function collectFiles(root, relativePath) {\n  const absolutePath = path.join(root, relativePath);\n  let stat;\n  try {\n    stat = await fs.stat(absolutePath);\n  } catch (error) {\n    if (error && error.code === \"ENOENT\") return [];\n    throw error;\n  }\n  if (stat.isFile()) return [relativePath];\n  if (!stat.isDirectory()) return [];\n\n  const entries = await fs.readdir(absolutePath, { withFileTypes: true });\n  const files = [];\n  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {\n    if (entry.name === \".DS_Store\") continue;\n    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));\n  }\n  return files;\n}\n\nasync function fingerprintInputs(root) {\n  const hash = createHash(\"sha256\");\n  const files = [];\n  for (const inputPath of INPUT_PATHS) {\n    files.push(...await collectFiles(root, inputPath));\n  }\n  files.sort((left, right) => left.localeCompare(right));\n  if (files.length === 0) throw new Error(\"No interface build inputs were found.\");\n  for (const relativePath of files) {\n    hash.update(relativePath.split(path.sep).join(\"/\"));\n    hash.update(\"\\0\");\n    hash.update(await fs.readFile(path.join(root, relativePath)));\n    hash.update(\"\\0\");\n  }\n  return hash.digest(\"hex\");\n}\n\nasync function validateOutput(root) {\n  const outputDir = path.join(root, \"dist\", \"interface\");\n  const indexPath = path.join(outputDir, \"index.html\");\n  let html;\n  try {\n    html = await fs.readFile(indexPath, \"utf8\");\n  } catch (error) {\n    if (error && error.code === \"ENOENT\") {\n      return { ok: false, reason: \"production interface is missing\" };\n    }\n    throw error;\n  }\n\n  const references = [...html.matchAll(/(?:src|href)=[\"']\\/?(assets\\/[^\"'#?]+)[\"']/g)]\n    .map((match) => match[1]);\n  if (references.length === 0) {\n    return { ok: false, reason: \"production interface has no referenced assets\" };\n  }\n  for (const reference of references) {\n    try {\n      const stat = await fs.stat(path.join(outputDir, reference));\n      if (!stat.isFile()) throw new Error(\"not a file\");\n    } catch {\n      return { ok: false, reason: `referenced asset is missing: ${reference}` };\n    }\n  }\n  return { ok: true, outputDir };\n}\n\nasync function readMarker(outputDir) {\n  try {\n    return JSON.parse(await fs.readFile(path.join(outputDir, \".build-state.json\"), \"utf8\"));\n  } catch {\n    return null;\n  }\n}\n\nasync function check(root) {\n  const output = await validateOutput(root);\n  if (!output.ok) return output.reason;\n  const marker = await readMarker(output.outputDir);\n  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== \"string\") {\n    return \"build marker is missing or invalid\";\n  }\n  const fingerprint = await fingerprintInputs(root);\n  if (marker.fingerprint !== fingerprint) return \"source fingerprint changed\";\n  return null;\n}\n\nasync function write(root) {\n  const output = await validateOutput(root);\n  if (!output.ok) throw new Error(output.reason);\n  const markerPath = path.join(output.outputDir, \".build-state.json\");\n  const temporaryPath = `${markerPath}.tmp-${process.pid}`;\n  const marker = {\n    version: MARKER_VERSION,\n    fingerprint: await fingerprintInputs(root),\n  };\n  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\\n`, \"utf8\");\n  await fs.rename(temporaryPath, markerPath);\n  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\\n`);\n}\n\nasync function main() {\n  const { mode, root } = readArgs(process.argv.slice(2));\n  if (mode === \"--write\") {\n    await write(root);\n    return;\n  }\n  const reason = await check(root);\n  if (reason) {\n    process.stdout.write(`[omniharness] Interface build required: ${reason}.\\n`);\n    process.exit(BUILD_REQUIRED_EXIT);\n  }\n  process.stdout.write(\"[omniharness] Production interface is current.\\n\");\n}\n\nmain().catch((error) => {\n  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\\n`);\n  process.exit(1);\n});\n\n--- NEW FILE scripts/setup-tailscale.mjs ---\n#!/usr/bin/env node\n\nimport fs from \"node:fs\";\nimport fsp from \"node:fs/promises\";\nimport path from \"node:path\";\nimport { spawnSync } from \"node:child_process\";\n\nconst MANAGED_START = \"# omniharness-tailscale-managed:start\";\nconst MANAGED_END = \"# omniharness-tailscale-managed:end\";\nconst OWNED_KEYS = [\"OMNIHARNESS_PUBLIC_ORIGIN\", \"OMNIHARNESS_RUNNER_HOST\"];\n\nfunction readArgs(argv) {\n  if (argv[0] === \"--\") argv = argv.slice(1);\n  const options = {\n    root: process.cwd(),\n    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || \"3050\"),\n    dryRun: false,\n    force: false,\n    reset: false,\n  };\n  for (let index = 0; index < argv.length; index += 1) {\n    const arg = argv[index];\n    if (arg === \"--root\" || arg === \"--port\") {\n      const value = argv[index + 1];\n      if (!value) throw new TypeError(`${arg} requires a value.`);\n      if (arg === \"--root\") options.root = path.resolve(value);\n      else options.port = Number(value);\n      index += 1;\n      continue;\n    }\n    if (arg === \"--dry-run\") options.dryRun = true;\n    else if (arg === \"--force\") options.force = true;\n    else if (arg === \"--reset\") options.reset = true;\n    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);\n  }\n  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {\n    throw new TypeError(\"--port must be an integer from 1 to 65535.\");\n  }\n  return options;\n}\n\nfunction isExecutable(filePath) {\n  try {\n    fs.accessSync(filePath, fs.constants.X_OK);\n    return true;\n  } catch {\n    return false;\n  }\n}\n\nfunction findTailscale() {\n  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();\n  if (explicit) return isExecutable(explicit) ? explicit : null;\n  for (const directory of (process.env.PATH || \"\").split(path.delimiter)) {\n    if (!directory) continue;\n    const candidate = path.join(directory, \"tailscale\");\n    if (isExecutable(candidate)) return candidate;\n  }\n  for (const candidate of [\n    \"/Applications/Tailscale.app/Contents/MacOS/Tailscale\",\n    \"/Applications/Tailscale.app/Contents/MacOS/tailscale\",\n  ]) {\n    if (isExecutable(candidate)) return candidate;\n  }\n  return null;\n}\n\nfunction invoke(tailscale, args, options = {}) {\n  const result = spawnSync(tailscale, args, { encoding: \"utf8\" });\n  if (result.error) throw result.error;\n  if (result.status !== 0 && !options.allowFailure) {\n    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();\n    throw new Error(`${detail}\\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);\n  }\n  return result;\n}\n\nfunction readTailnetStatus(tailscale) {\n  const result = invoke(tailscale, [\"status\", \"--json\"]);\n  let status;\n  try {\n    status = JSON.parse(result.stdout);\n  } catch {\n    throw new Error(\"Tailscale returned invalid status JSON.\");\n  }\n  if (status.BackendState !== \"Running\") {\n    throw new Error(`Tailscale is not connected (state: ${status.BackendState || \"unknown\"}). Run \\`tailscale up\\`, then retry.`);\n  }\n  const dnsName = String(status.Self?.DNSName || \"\").replace(/\\.$/, \"\");\n  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\\.ts\\.net$/.test(dnsName)) {\n    throw new Error(\"Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.\");\n  }\n  return { dnsName, origin: `https://${dnsName}` };\n}\n\nfunction removeManagedBlock(text) {\n  const start = text.indexOf(MANAGED_START);\n  if (start === -1) return text;\n  const end = text.indexOf(MANAGED_END, start);\n  if (end === -1) throw new Error(\"The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.\");\n  let removeStart = start;\n  if (removeStart > 0 && text[removeStart - 1] === \"\\n\") removeStart -= 1;\n  let removeEnd = end + MANAGED_END.length;\n  if (text[removeEnd] === \"\\r\") removeEnd += 1;\n  if (text[removeEnd] === \"\\n\") removeEnd += 1;\n  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;\n}\n\nfunction activeOwnedSettings(text) {\n  const values = new Map();\n  for (const line of removeManagedBlock(text).split(/\\r?\\n/)) {\n    if (/^\\s*#/.test(line)) continue;\n    const match = line.match(/^\\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\\s*=\\s*(.*)\\s*$/);\n    if (match) values.set(match[1], match[2]);\n  }\n  return values;\n}\n\nfunction buildManagedEnv(text, settings, force) {\n  const withoutManaged = removeManagedBlock(text);\n  const existing = activeOwnedSettings(withoutManaged);\n  const conflicts = OWNED_KEYS.filter((key) => {\n    const current = existing.get(key);\n    return current && current !== settings[key];\n  });\n  if (conflicts.length > 0 && !force) {\n    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(\", \");\n    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);\n  }\n\n  const keptLines = [];\n  const previousLines = [];\n  for (const line of withoutManaged.split(/\\r?\\n/)) {\n    const match = line.match(/^\\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\\s*=\\s*(.*)\\s*$/);\n    if (!match) {\n      keptLines.push(line);\n      continue;\n    }\n    if (force && match[2] && match[2] !== settings[match[1]]) {\n      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);\n    }\n  }\n  while (keptLines.at(-1) === \"\") keptLines.pop();\n  const base = [...keptLines, ...previousLines].join(\"\\n\");\n  const block = [\n    MANAGED_START,\n    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,\n    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,\n    MANAGED_END,\n  ].join(\"\\n\");\n  return `${base ? `${base}\\n\\n` : \"\"}${block}\\n`;\n}\n\nfunction resetManagedEnv(text) {\n  return removeManagedBlock(text).replace(/\\n{2,}$/g, \"\\n\");\n}\n\nasync function readEnv(envPath) {\n  try {\n    return await fsp.readFile(envPath, \"utf8\");\n  } catch (error) {\n    if (error?.code === \"ENOENT\") return \"\";\n    throw error;\n  }\n}\n\nasync function stageEnv(envPath, text) {\n  await fsp.mkdir(path.dirname(envPath), { recursive: true });\n  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;\n  await fsp.writeFile(temporaryPath, text, { encoding: \"utf8\", mode: 0o600 });\n  await fsp.chmod(temporaryPath, 0o600);\n  return temporaryPath;\n}\n\nfunction inspectServeState(tailscale, target, force) {\n  const result = invoke(tailscale, [\"serve\", \"status\", \"--json\"], { allowFailure: true });\n  if (result.status !== 0 || !result.stdout.trim()) return;\n  try {\n    const status = JSON.parse(result.stdout);\n    if (Object.keys(status).length > 0 && !JSON.stringify(status).includes(target) && !force) {\n      throw new Error(\"Tailscale already has Serve configuration on this device. Re-run with --force only if OmniHarness may replace the default HTTPS listener.\");\n    }\n  } catch (error) {\n    if (error instanceof SyntaxError) return;\n    throw error;\n  }\n}\n\nasync function setup(options, tailscale) {\n  const { origin } = readTailnetStatus(tailscale);\n  const target = `http://127.0.0.1:${options.port}`;\n  inspectServeState(tailscale, target, options.force);\n  const envPath = path.join(options.root, \".env\");\n  const currentEnv = await readEnv(envPath);\n  const nextEnv = buildManagedEnv(currentEnv, {\n    OMNIHARNESS_PUBLIC_ORIGIN: origin,\n    OMNIHARNESS_RUNNER_HOST: \"127.0.0.1\",\n  }, options.force);\n\n  if (options.dryRun) {\n    process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\\n`);\n    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\\n`);\n    return;\n  }\n\n  const stagedPath = await stageEnv(envPath, nextEnv);\n  try {\n    invoke(tailscale, [\"serve\", \"--bg\", target]);\n  } catch (error) {\n    await fsp.rm(stagedPath, { force: true });\n    throw error;\n  }\n  try {\n    await fsp.rename(stagedPath, envPath);\n  } catch (error) {\n    const rollback = invoke(tailscale, [\"serve\", \"--https=443\", \"off\"], { allowFailure: true });\n    await fsp.rm(stagedPath, { force: true });\n    const rollbackDetail = rollback.status === 0 ? \"The new Serve listener was disabled.\" : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;\n    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\\n${error instanceof Error ? error.message : String(error)}`);\n  }\n  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\\n`);\n  process.stdout.write(\"[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\\n\");\n}\n\nasync function reset(options, tailscale) {\n  const envPath = path.join(options.root, \".env\");\n  const currentEnv = await readEnv(envPath);\n  const nextEnv = resetManagedEnv(currentEnv);\n  if (options.dryRun) {\n    process.stdout.write(\"[omniharness] Would run: tailscale serve --https=443 off\\n\");\n    process.stdout.write(\"[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\\n\");\n    return;\n  }\n  const stagedPath = await stageEnv(envPath, nextEnv);\n  try {\n    invoke(tailscale, [\"serve\", \"--https=443\", \"off\"]);\n    await fsp.rename(stagedPath, envPath);\n  } catch (error) {\n    await fsp.rm(stagedPath, { force: true });\n    throw error;\n  }\n  process.stdout.write(\"[omniharness] Disabled the OmniHarness HTTPS Serve listener and removed its managed .env settings.\\n\");\n}\n\nasync function main() {\n  const options = readArgs(process.argv.slice(2));\n  const tailscale = findTailscale();\n  if (!tailscale) {\n    throw new Error(\"Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac\");\n  }\n  if (options.reset) await reset(options, tailscale);\n  else await setup(options, tailscale);\n}\n\nmain().catch((error) => {\n  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\\n`);\n  process.exit(1);\n});\n\n--- NEW FILE .github/workflows/install-smoke.yml ---\nname: Verify macOS installation\n\non:\n  push:\n    branches: [master]\n  pull_request:\n  workflow_dispatch:\n\npermissions:\n  contents: read\n\nconcurrency:\n  group: macos-install-${{ github.ref }}\n  cancel-in-progress: true\n\njobs:\n  macos-install:\n    name: Fresh Mac launcher\n    runs-on: macos-15\n    timeout-minutes: 20\n    env:\n      OMNIHARNESS_AUTH_PASSWORD: macos-release-smoke-password\n      OMNIHARNESS_ROOT: ${{ runner.temp }}/omniharness-install-smoke\n      OMNIHARNESS_RUNNER_HOST: 127.0.0.1\n      OMNIHARNESS_RUNNER_PORT: 3059\n      OMNIHARNESS_BRIDGE_URL: http://127.0.0.1:17809\n      OMNIHARNESS_OPEN_BROWSER: 0\n      OMNIHARNESS_SKIP_RECOMMENDED_TOOLS: 1\n\n    steps:\n      - name: Checkout\n        uses: actions/checkout@v4\n\n      - name: Setup supported Node\n        uses: actions/setup-node@v4\n        with:\n          node-version-file: .nvmrc\n\n      - name: Confirm this is a fresh interface install\n        run: test ! -e dist/interface/.build-state.json\n\n      - name: Start through the real Mac launcher\n        run: |\n          ./omniharness > \"$RUNNER_TEMP/omniharness-install.log\" 2>&1 &\n          echo \"$!\" > \"$RUNNER_TEMP/omniharness-install.pid\"\n\n      - name: Wait for API health\n        run: |\n          node --input-type=module <<'NODE'\n          const deadline = Date.now() + 120_000;\n          const url = \"http://127.0.0.1:3059/api/healthz\";\n          while (Date.now() < deadline) {\n            try {\n              const response = await fetch(url);\n              if (response.ok) process.exit(0);\n            } catch {}\n            await new Promise((resolve) => setTimeout(resolve, 750));\n          }\n          throw new Error(`Timed out waiting for ${url}`);\n          NODE\n\n      - name: Verify production interface and build marker\n        run: |\n          node --input-type=module <<'NODE'\n          import fs from \"node:fs\";\n          const origin = \"http://127.0.0.1:3059\";\n          const response = await fetch(origin);\n          if (!response.ok) throw new Error(`Interface returned ${response.status}`);\n          const html = await response.text();\n          if (!html.includes(\"OmniHarness\")) throw new Error(\"Response is not the OmniHarness interface\");\n          const assetPath = html.match(/(?:src|href)=[\"'](\\/assets\\/[^\"'#?]+)[\"']/)?.[1];\n          if (!assetPath) throw new Error(\"Interface HTML references no hashed asset\");\n          const assetResponse = await fetch(new URL(assetPath, origin));\n          if (!assetResponse.ok) throw new Error(`Interface asset returned ${assetResponse.status}: ${assetPath}`);\n          const marker = JSON.parse(fs.readFileSync(\"dist/interface/.build-state.json\", \"utf8\"));\n          if (marker.version !== 1 || !/^[a-f0-9]{64}$/.test(marker.fingerprint)) {\n            throw new Error(\"Interface build marker is invalid\");\n          }\n          NODE\n\n      - name: Show launcher log on failure\n        if: failure()\n        run: test ! -f \"$RUNNER_TEMP/omniharness-install.log\" || tail -n 300 \"$RUNNER_TEMP/omniharness-install.log\"\n\n      - name: Upload launcher log on failure\n        if: failure()\n        uses: actions/upload-artifact@v4\n        with:\n          name: macos-install-log\n          path: ${{ runner.temp }}/omniharness-install.log\n\n      - name: Stop isolated runner\n        if: always()\n        run: |\n          if test -f \"$RUNNER_TEMP/omniharness-install.pid\"; then\n            install_pid=\"$(cat \"$RUNNER_TEMP/omniharness-install.pid\")\"\n            if test -n \"$install_pid\" && kill -0 \"$install_pid\" 2>/dev/null; then\n              kill \"$install_pid\"\n              wait \"$install_pid\" 2>/dev/null || true\n            fi\n          fi\n\n--- NEW FILE tests/scripts/interface-build-state.test.ts ---\nimport fs from \"node:fs\";\nimport os from \"node:os\";\nimport path from \"node:path\";\nimport { spawnSync } from \"node:child_process\";\nimport { afterEach, describe, expect, it } from \"vitest\";\n\nconst scriptPath = path.resolve(process.cwd(), \"scripts/interface-build-state.mjs\");\nconst tempRoots: string[] = [];\n\nfunction createFixture() {\n  const root = fs.mkdtempSync(path.join(os.tmpdir(), \"omniharness-interface-state-\"));\n  tempRoots.push(root);\n  fs.mkdirSync(path.join(root, \"apps\", \"interface\"), { recursive: true });\n  fs.mkdirSync(path.join(root, \"src\", \"interface\"), { recursive: true });\n  fs.writeFileSync(path.join(root, \"package.json\"), '{\"name\":\"fixture\"}\\n');\n  fs.writeFileSync(path.join(root, \"pnpm-lock.yaml\"), \"lockfileVersion: '9.0'\\n\");\n  fs.writeFileSync(path.join(root, \"apps\", \"interface\", \"index.html\"), \"<div id=\\\"root\\\"></div>\\n\");\n  fs.writeFileSync(path.join(root, \"src\", \"interface\", \"main.ts\"), \"export const version = 1;\\n\");\n  return root;\n}\n\nfunction run(root: string, flag: \"--check\" | \"--write\") {\n  return spawnSync(process.execPath, [scriptPath, flag, \"--root\", root], {\n    encoding: \"utf8\",\n  });\n}\n\nfunction writeBuiltInterface(root: string) {\n  const output = path.join(root, \"dist\", \"interface\");\n  fs.mkdirSync(path.join(output, \"assets\"), { recursive: true });\n  fs.writeFileSync(\n    path.join(output, \"index.html\"),\n    '<!doctype html><script type=\"module\" src=\"/assets/index-abc123.js\"></script>',\n  );\n  fs.writeFileSync(path.join(output, \"assets\", \"index-abc123.js\"), \"console.log('ready');\\n\");\n}\n\nafterEach(() => {\n  for (const root of tempRoots.splice(0)) {\n    fs.rmSync(root, { recursive: true, force: true });\n  }\n});\n\ndescribe(\"interface build state\", () => {\n  it(\"requires a build when the interface output is missing\", () => {\n    const result = run(createFixture(), \"--check\");\n    expect(result.status).toBe(10);\n    expect(result.stdout).toContain(\"build required\");\n  });\n\n  it(\"accepts a complete output only after writing its matching source fingerprint\", () => {\n    const root = createFixture();\n    writeBuiltInterface(root);\n\n    expect(run(root, \"--check\").status).toBe(10);\n    expect(run(root, \"--write\").status).toBe(0);\n    expect(run(root, \"--check\").status).toBe(0);\n\n    const marker = JSON.parse(\n      fs.readFileSync(path.join(root, \"dist\", \"interface\", \".build-state.json\"), \"utf8\"),\n    ) as { version: number; fingerprint: string };\n    expect(marker.version).toBe(1);\n    expect(marker.fingerprint).toMatch(/^[a-f0-9]{64}$/);\n  });\n\n  it(\"requires another build when a source input changes\", () => {\n    const root = createFixture();\n    writeBuiltInterface(root);\n    expect(run(root, \"--write\").status).toBe(0);\n\n    fs.writeFileSync(path.join(root, \"src\", \"interface\", \"main.ts\"), \"export const version = 2;\\n\");\n    const result = run(root, \"--check\");\n    expect(result.status).toBe(10);\n    expect(result.stdout).toContain(\"fingerprint changed\");\n  });\n\n  it(\"refuses to bless output whose referenced asset is missing\", () => {\n    const root = createFixture();\n    writeBuiltInterface(root);\n    fs.rmSync(path.join(root, \"dist\", \"interface\", \"assets\", \"index-abc123.js\"));\n\n    const result = run(root, \"--write\");\n    expect(result.status).not.toBe(0);\n    expect(result.stderr).toContain(\"referenced asset is missing\");\n  });\n});\n\n--- NEW FILE tests/scripts/runner-help.test.ts ---\nimport { spawnSync } from \"node:child_process\";\nimport { describe, expect, it } from \"vitest\";\n\ndescribe(\"runner help\", () => {\n  it(\"prints runner-specific options through pnpm without starting the server\", () => {\n    const result = spawnSync(\"pnpm\", [\"runner\", \"--\", \"--help\"], {\n      cwd: process.cwd(),\n      encoding: \"utf8\",\n    });\n\n    expect(result.status).toBe(0);\n    expect(result.stdout).toContain(\"Usage: pnpm runner -- [options]\");\n    expect(result.stdout).toContain(\"--static-dir <directory>\");\n    expect(result.stdout).toContain(\"--no-static\");\n    expect(result.stdout).toContain(\"--interface-dev-url <url>\");\n    expect(result.stdout).not.toContain(\"runner.ready\");\n  });\n});\n\n--- NEW FILE tests/scripts/setup-tailscale.test.ts ---\nimport fs from \"node:fs\";\nimport os from \"node:os\";\nimport path from \"node:path\";\nimport { spawnSync } from \"node:child_process\";\nimport { afterEach, describe, expect, it } from \"vitest\";\n\nconst scriptPath = path.resolve(process.cwd(), \"scripts/setup-tailscale.mjs\");\nconst tempRoots: string[] = [];\n\nfunction createFixture(options: { backendState?: string; dnsName?: string; serveFails?: boolean } = {}) {\n  const root = fs.mkdtempSync(path.join(os.tmpdir(), \"omniharness-tailscale-\"));\n  tempRoots.push(root);\n  const binDir = path.join(root, \"bin\");\n  const logPath = path.join(root, \"tailscale.log\");\n  const tailscalePath = path.join(binDir, \"tailscale\");\n  fs.mkdirSync(binDir, { recursive: true });\n  fs.writeFileSync(tailscalePath, `#!/bin/sh\necho \"$@\" >> \"$OMNI_TEST_TAILSCALE_LOG\"\nif [ \"$1\" = \"status\" ] && [ \"$2\" = \"--json\" ]; then\n  printf '%s\\n' \"$OMNI_TEST_TAILSCALE_STATUS\"\n  exit 0\nfi\nif [ \"$1\" = \"serve\" ] && [ \"$2\" = \"status\" ] && [ \"$3\" = \"--json\" ]; then\n  printf '{}\\n'\n  exit 0\nfi\nif [ \"$OMNI_TEST_TAILSCALE_SERVE_FAILS\" = \"1\" ]; then\n  echo \"Serve permission denied; configure an operator or administrator\" >&2\n  exit 1\nfi\nexit 0\n`);\n  fs.chmodSync(tailscalePath, 0o755);\n  return {\n    root,\n    logPath,\n    tailscalePath,\n    env: {\n      ...process.env,\n      OMNIHARNESS_TAILSCALE_BIN: tailscalePath,\n      OMNI_TEST_TAILSCALE_LOG: logPath,\n      OMNI_TEST_TAILSCALE_STATUS: JSON.stringify({\n        BackendState: options.backendState ?? \"Running\",\n        Self: { DNSName: options.dnsName ?? \"studio.example-tailnet.ts.net.\" },\n      }),\n      OMNI_TEST_TAILSCALE_SERVE_FAILS: options.serveFails ? \"1\" : \"0\",\n    },\n  };\n}\n\nfunction run(\n  fixture: ReturnType<typeof createFixture>,\n  args: string[] = [],\n  env: NodeJS.ProcessEnv = fixture.env,\n) {\n  return spawnSync(process.execPath, [scriptPath, \"--root\", fixture.root, ...args], {\n    encoding: \"utf8\",\n    env,\n  });\n}\n\nafterEach(() => {\n  for (const root of tempRoots.splice(0)) {\n    fs.rmSync(root, { recursive: true, force: true });\n  }\n});\n\ndescribe(\"Tailscale private access setup\", () => {\n  it(\"accepts option forwarding through the documented pnpm command\", () => {\n    const fixture = createFixture();\n    const result = spawnSync(\n      \"pnpm\",\n      [\"setup:tailscale\", \"--\", \"--root\", fixture.root, \"--dry-run\"],\n      {\n      cwd: process.cwd(),\n      encoding: \"utf8\",\n      env: fixture.env,\n      },\n    );\n\n    expect(result.status, result.stderr).toBe(0);\n    expect(result.stdout).toContain(\"Would run: tailscale serve --bg http://127.0.0.1:3050\");\n  });\n\n  it(\"fails with an install link before changing anything when Tailscale is missing\", () => {\n    const fixture = createFixture();\n    const result = run(fixture, [], {\n      ...fixture.env,\n      OMNIHARNESS_TAILSCALE_BIN: path.join(fixture.root, \"missing-tailscale\"),\n    });\n\n    expect(result.status).not.toBe(0);\n    expect(result.stderr).toContain(\"https://tailscale.com/download/mac\");\n    expect(fs.existsSync(path.join(fixture.root, \".env\"))).toBe(false);\n  });\n\n  it(\"fails without invoking Serve when the Mac is not connected to a tailnet\", () => {\n    const fixture = createFixture({ backendState: \"Stopped\" });\n    const result = run(fixture);\n\n    expect(result.status).not.toBe(0);\n    expect(result.stderr).toContain(\"tailscale up\");\n    expect(fs.readFileSync(fixture.logPath, \"utf8\")).toBe(\"status --json\\n\");\n    expect(fs.existsSync(path.join(fixture.root, \".env\"))).toBe(false);\n  });\n\n  it(\"shows the exact private Serve change in dry-run mode without mutating state\", () => {\n    const fixture = createFixture();\n    const result = run(fixture, [\"--dry-run\"]);\n\n    expect(result.status).toBe(0);\n    expect(result.stdout).toContain(\"https://studio.example-tailnet.ts.net\");\n    expect(result.stdout).toContain(\"tailscale serve --bg http://127.0.0.1:3050\");\n    expect(fs.readFileSync(fixture.logPath, \"utf8\")).toBe(\"status --json\\nserve status --json\\n\");\n    expect(fs.existsSync(path.join(fixture.root, \".env\"))).toBe(false);\n  });\n\n  it(\"configures private Serve and atomically writes owned OmniHarness settings\", () => {\n    const fixture = createFixture();\n    fs.writeFileSync(path.join(fixture.root, \".env\"), \"EXISTING_SETTING=kept\\n\");\n    const result = run(fixture);\n\n    expect(result.status).toBe(0);\n    expect(fs.readFileSync(fixture.logPath, \"utf8\")).toContain(\n      \"serve --bg http://127.0.0.1:3050\",\n    );\n    expect(fs.readFileSync(path.join(fixture.root, \".env\"), \"utf8\")).toBe(\n      \"EXISTING_SETTING=kept\\n\\n\"\n      + \"# omniharness-tailscale-managed:start\\n\"\n      + \"OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\\n\"\n      + \"OMNIHARNESS_RUNNER_HOST=127.0.0.1\\n\"\n      + \"# omniharness-tailscale-managed:end\\n\",\n    );\n  });\n\n  it(\"refuses to replace an existing public or LAN deployment without --force\", () => {\n    const fixture = createFixture();\n    const envPath = path.join(fixture.root, \".env\");\n    fs.writeFileSync(\n      envPath,\n      \"OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\\n\",\n    );\n    const result = run(fixture);\n\n    expect(result.status).not.toBe(0);\n    expect(result.stderr).toContain(\"--force\");\n    expect(fs.readFileSync(envPath, \"utf8\")).toContain(\"https://public.example.com\");\n    expect(fs.readFileSync(fixture.logPath, \"utf8\")).not.toContain(\"serve --bg\");\n  });\n\n  it(\"preserves overridden values as comments when --force is explicit\", () => {\n    const fixture = createFixture();\n    const envPath = path.join(fixture.root, \".env\");\n    fs.writeFileSync(\n      envPath,\n      \"OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\\n\",\n    );\n    const result = run(fixture, [\"--force\"]);\n\n    expect(result.status).toBe(0);\n    const envText = fs.readFileSync(envPath, \"utf8\");\n    expect(envText).toContain(\"# omniharness-tailscale-previous: OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\");\n    expect(envText).toContain(\"# omniharness-tailscale-previous: OMNIHARNESS_RUNNER_HOST=0.0.0.0\");\n    expect(envText).toContain(\"OMNIHARNESS_RUNNER_HOST=127.0.0.1\");\n  });\n\n  it(\"leaves .env unchanged when Tailscale refuses Serve configuration\", () => {\n    const fixture = createFixture({ serveFails: true });\n    const envPath = path.join(fixture.root, \".env\");\n    fs.writeFileSync(envPath, \"EXISTING_SETTING=kept\\n\");\n    const result = run(fixture);\n\n    expect(result.status).not.toBe(0);\n    expect(result.stderr).toContain(\"Serve permission denied\");\n    expect(result.stderr).toContain(\"administrator\");\n    expect(fs.readFileSync(envPath, \"utf8\")).toBe(\"EXISTING_SETTING=kept\\n\");\n    expect(fs.readdirSync(fixture.root).filter((name) => name.includes(\"tailscale.tmp\"))).toEqual([]);\n  });\n\n  it(\"removes only managed settings and disables the owned HTTPS listener on reset\", () => {\n    const fixture = createFixture();\n    const envPath = path.join(fixture.root, \".env\");\n    fs.writeFileSync(\n      envPath,\n      \"EXISTING_SETTING=kept\\n\\n\"\n      + \"# omniharness-tailscale-managed:start\\n\"\n      + \"OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\\n\"\n      + \"OMNIHARNESS_RUNNER_HOST=127.0.0.1\\n\"\n      + \"# omniharness-tailscale-managed:end\\n\",\n    );\n    const result = run(fixture, [\"--reset\"]);\n\n    expect(result.status).toBe(0);\n    expect(fs.readFileSync(fixture.logPath, \"utf8\")).toContain(\"serve --https=443 off\");\n    expect(fs.readFileSync(envPath, \"utf8\")).toBe(\"EXISTING_SETTING=kept\\n\");\n  });\n});\n\n--- NEW FILE tests/scripts/mac-install-workflow.test.ts ---\nimport fs from \"node:fs\";\nimport path from \"node:path\";\nimport { describe, expect, it } from \"vitest\";\nimport yaml from \"js-yaml\";\n\ndescribe(\"macOS clean installation release check\", () => {\n  it(\"runs the real launcher and verifies health, HTML, an asset, and the build marker\", () => {\n    const workflowPath = path.resolve(process.cwd(), \".github/workflows/install-smoke.yml\");\n    const source = fs.readFileSync(workflowPath, \"utf8\");\n    const workflow = yaml.load(source) as { jobs?: Record<string, { \"runs-on\"?: string }> };\n\n    expect(workflow.jobs?.[\"macos-install\"]?.[\"runs-on\"]).toBe(\"macos-15\");\n    expect(source).toContain(\"./omniharness\");\n    expect(source).toContain(\"OMNIHARNESS_AUTH_PASSWORD\");\n    expect(source).toContain(\"OMNIHARNESS_RUNNER_PORT: 3059\");\n    expect(source).toContain(\"/api/healthz\");\n    expect(source).toContain(\"dist/interface/.build-state.json\");\n    expect(source).toContain(\"assetPath\");\n    expect(source).toContain(\"if: always()\");\n  });\n});\n"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:58:33.004Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:58:33.004Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-05T20:58:33.004Z",
  "sessionId": "5d9e378d-ff6b-44ad-a39f-5ddbe539dcd9"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-05T20:58:33.041Z","phase":null} -->
## User · 2026-08-05T20:58:33.041Z

You are a tool-free senior code reviewer. Do not inspect files or call tools. Review only this supplied patch.

Goal: Mac-first OmniHarness release installation. ./omniharness must install deps and published ACP packages, load .env, build/serve Vite UI plus API, recommend explicit Tailscale Serve private access, and have clean Mac CI. Windows is out.

Constraints: no branches/worktrees, preserve unrelated dirty changes, no silent Funnel/public access, ACP bridge stays loopback.

Verification already run: 27 focused tests, typecheck, targeted eslint, Vite build, ACP 42-method check, real Tailscale dry-run, isolated live launcher health/HTML/asset 200 and clean shutdown.

Look for correctness, security, destructive behavior, race/rollback bugs, false documentation claims, shell/Node portability issues, and tests that do not prove their claim. Return:
1. Verdict READY or FIX
2. Critical/important issues only, each with concrete fix
3. Minor observations

TRACKED DIFF:
diff --git a/.env.example b/.env.example
index 74a9ee7..548a838 100644
--- a/.env.example
+++ b/.env.example
@@ -5,11 +5,12 @@
 # Prefer OMNIHARNESS_AUTH_PASSWORD_HASH if this env file may be viewed by others.
 # OMNIHARNESS_AUTH_PASSWORD_HASH=
 
-# Optional: public or LAN origin for phone pairing and remote access links.
-# OMNIHARNESS_PUBLIC_ORIGIN=https://example.trycloudflare.com
+# Optional: private origin for phone pairing and remote access links.
+# `pnpm setup:tailscale` manages this plus the loopback runner host automatically.
+# OMNIHARNESS_PUBLIC_ORIGIN=https://your-mac.your-tailnet.ts.net
 
 # Runner/API deployment. The ACP bridge remains loopback by default.
-# OMNIHARNESS_RUNNER_HOST=0.0.0.0
+# OMNIHARNESS_RUNNER_HOST=127.0.0.1
 # OMNIHARNESS_RUNNER_PORT=3050
 # OMNIHARNESS_BRIDGE_URL=http://127.0.0.1:7800
 # OMNIHARNESS_MANAGE_BRIDGE=1
@@ -42,12 +43,10 @@
 # ANTHROPIC_API_KEY=
 # GEMINI_API_KEY=
 
-# Optional: avoid compiling codex-acp with host Rust. Auto downloads a prebuilt binary.
-# Windows PowerShell users can set OMNIHARNESS_CODEX_ACP_INSTALL_DIR to a user bin directory.
+# Optional Codex ACP package locations. Auto installs the maintained published
+# npm adapter and the matching published Codex binary; it does not compile ACP.
 # OMNIHARNESS_CODEX_ACP_INSTALL=auto
-# OMNIHARNESS_CODEX_ACP_RELEASE_REPO=danduma/omniharness
-# OMNIHARNESS_CODEX_ACP_RELEASE_TAG=codex-acp-latest
-# OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL=https://github.com/danduma/omniharness/releases/download/codex-acp-latest
+# OMNIHARNESS_CODEX_ACP_NPM_ROOT=/Users/you/.local/share/omniharness/codex-acp
 # OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/Users/you/.local/bin
 # Optional fallback: run codex-acp through Docker or Podman instead.
 # OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE=omniharness/codex-acp:local
diff --git a/README.md b/README.md
index 97b467b..a259fa1 100644
--- a/README.md
+++ b/README.md
@@ -25,31 +25,23 @@ OmniHarness is early open-source software under active development. Expect sharp
 
 ## Requirements
 
-- macOS, Linux, or Windows with a normal developer shell. On Windows, use PowerShell for the setup commands below.
-- Node.js 22.13 or newer, up to but not including Node.js 26. If you use `nvm`, run `nvm use` from the repo root to select the recommended local version.
-- pnpm 9 or newer. The `packageManager` field in `package.json` is a known-good Corepack default, not an exact-version requirement.
+- macOS with `git`, `curl`, and a normal Terminal shell. This is the release-gated installation path. Linux uses the same shell launcher but is not a release gate yet.
+- Node.js 22.13 or newer, up to but not including Node.js 26. The launcher selects the repo version through `nvm` and installs `nvm` when necessary.
+- pnpm 9 or newer. The launcher uses an existing compatible pnpm, Corepack, or npm to install the repo's known-good version.
 - `ripgrep` (`rg`) is recommended for fast agent repository search. The `./omniharness` launcher installs it automatically when a supported system package manager is available. Set `OMNIHARNESS_SKIP_RECOMMENDED_TOOLS=1` to skip recommended tool setup.
 - At least one supported coding agent when you want to run real workers:
-  - Codex CLI plus `codex-acp`
+  - Codex; the launcher installs the maintained ACP adapter and Codex CLI as published packages
   - Claude CLI plus `claude-agent-acp`
   - Gemini CLI with native ACP mode
   - OpenCode with native ACP mode
-- Docker, if you want OmniHarness to run `codex-acp` from a container instead
-  of compiling the Rust adapter on the host.
 
 ## Quick Start
 
-Clone the repo, enter it, and select the recommended Node version:
+Clone the repo and start it:
 
 ```bash
-git clone <repo-url> omniharness
+git clone https://github.com/danduma/omniharness.git
 cd omniharness
-nvm use
-```
-
-Start OmniHarness normally:
-
-```bash
 ./omniharness
 ```
 
@@ -62,12 +54,16 @@ The launcher opens [http://localhost:3050](http://localhost:3050) when the local
 server is ready. Set `OMNIHARNESS_OPEN_BROWSER=0` if you do not want it to open a
 browser automatically.
 
-`./omniharness` installs dependencies when needed, builds the static interface
-when needed, then starts the two processes in one logical runner deployment:
+`./omniharness` checks Node and pnpm, installs repository dependencies, installs
+or refreshes published ACP packages, and builds the Vite interface when its
+content fingerprint changes. It then starts one logical runner deployment:
 
-- the API/SSE server and static interface on `http://localhost:3050`
+- the API/SSE server and production web interface together on `http://localhost:3050`
 - the co-located ACP bridge on `http://127.0.0.1:7800`
 
+There is no separate production UI server to install or expose. The separate
+Vite process is only for development.
+
 Start the runner directly with `pnpm runner`. Use `--no-static` for a supported
 API-only deployment, or `--static-dir <path>` for an explicit interface
 artifact.
@@ -91,47 +87,6 @@ Operational and security details:
 - [Authentication, sessions, credential storage, identity, and TLS](docs/security/authentication-and-tls.md)
 - [Desktop/editor migration, mobile/PWA limits, and v1 non-goals](docs/platforms/client-migration-and-limits.md)
 
-### Windows Quick Start
-
-Use PowerShell from the repo root. If Corepack can write to your Node.js
-installation, enable the repo's package manager normally:
-
-```powershell
-corepack enable
-corepack prepare pnpm@11.2.2 --activate
-```
-
-If Corepack fails with an `EPERM` error under `C:\Program Files\nodejs`, install
-pnpm into the user npm prefix instead:
-
-```powershell
-$prefix = Join-Path $env:APPDATA "npm"
-New-Item -ItemType Directory -Force -Path $prefix | Out-Null
-npm config set prefix $prefix
-$env:Path = "$prefix;$env:Path"
-[Environment]::SetEnvironmentVariable("Path", "$prefix;$([Environment]::GetEnvironmentVariable("Path", "User"))", "User")
-npm install -g pnpm@11.2.2
-```
-
-Then clone, install, build, and start:
-
-```powershell
-git clone <repo-url> omniharness
-cd omniharness
-pnpm install
-Copy-Item .env.example .env
-# Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH in .env.
-pnpm build
-$env:OMNIHARNESS_OPEN_BROWSER = "0"
-pnpm start
-```
-
-The web UI listens on `http://localhost:3050` and the runtime listens on
-`http://127.0.0.1:7800`. For browser access from another machine, allow inbound
-TCP traffic to the web port in Windows Firewall and in any provider firewall, or
-put OmniHarness behind a tunnel or reverse proxy. Do not expose the runtime port
-directly to the public internet.
-
 Run the separate restart control app if you want a small remote escape hatch
 with its own password-gated interface:
 
@@ -166,8 +121,8 @@ curl -X POST "http://HOST:3099/restart?mode=dev" \
 
 Use `mode=prod` to launch `./omniharness` instead of `pnpm run dev`.
 
-For phone access through Cloudflare Tunnel, expose the restart app as a second
-hostname that points to `http://localhost:3099`, for example:
+For public access through Cloudflare Tunnel, expose the restart app as a second
+hostname only if you intentionally want that public-tunnel deployment:
 
 ```yaml
 ingress:
@@ -227,24 +182,60 @@ pnpm auth:password verify "new-password"
 Hash-only passwords cannot be printed back out. If `status` says the password is
 hash-only and you do not know it, run `pnpm auth:password set` to replace it.
 
-## Remote Tunnel
+## Private Access With Tailscale
 
-For phone or remote-browser access, expose only the web UI port through your
-tunnel provider. With Cloudflare Tunnel quick tunnels:
+Tailscale Serve is the recommended way to reach OmniHarness from another Mac,
+phone, or tablet. It keeps the service inside your tailnet, applies your
+Tailscale access rules, and provides a private HTTPS URL. Install the recommended
+standalone [Tailscale app for macOS](https://tailscale.com/download/mac), sign in,
+and then run:
 
 ```bash
-cloudflared tunnel --url http://localhost:3050
+pnpm setup:tailscale
 ```
 
-Copy the generated `https://...` URL into `.env` and restart OmniHarness:
+The command verifies the tailnet connection, refuses to overwrite an existing
+LAN or tunnel configuration, configures:
+
+```bash
+tailscale serve --bg http://127.0.0.1:3050
+```
+
+It then writes the private `https://...ts.net` origin and loopback bind address
+to the ignored local `.env`. Restart OmniHarness afterward:
 
 ```bash
-printf 'OMNIHARNESS_PUBLIC_ORIGIN=%s\n' 'https://your-tunnel-url' >> .env
 ./omniharness
 ```
 
-Keep OmniHarness password auth enabled even when your tunnel provider also has
-its own access controls.
+Check the real private route with `tailscale serve status`, then open the printed
+URL from another device on the tailnet. Password authentication remains required;
+tailnet membership is an additional security boundary, not a replacement.
+
+Useful safe operations:
+
+```bash
+pnpm setup:tailscale -- --dry-run  # inspect without changing Tailscale or .env
+pnpm setup:tailscale -- --force    # preserve conflicting values as comments, then replace them
+pnpm setup:tailscale -- --reset    # disable OmniHarness HTTPS Serve and remove managed settings
+```
+
+If Serve reports an operator, administrator, MagicDNS, or HTTPS-certificate
+problem, follow the exact Tailscale error and retry. The setup command leaves
+`.env` unchanged when Serve fails.
+
+### Optional Public Access With Cloudflare
+
+Use a public tunnel only when tailnet-only access is not sufficient. Expose port
+`3050`, never the ACP bridge on `7800`:
+
+```bash
+cloudflared tunnel --url http://localhost:3050
+```
+
+Set `OMNIHARNESS_PUBLIC_ORIGIN` in `.env` to the generated HTTPS URL and restart
+OmniHarness. Keep OmniHarness password authentication enabled even when the
+tunnel provider has separate access controls.
 
 The launcher does not require a global `omniharness` install. Run the app from
 the checkout with `./omniharness`, and run CLI conversations from the checkout
@@ -264,47 +255,33 @@ scripts/install-agent-acp.sh
 ```
 
 The setup script detects supported local coding agents and installs or refreshes
-the ACP adapters they need. Codex uses a prebuilt `codex-acp` binary by default
-for macOS/Linux on arm64/x64 and Windows x64. Claude's adapter is installed from npm, while
-Gemini and OpenCode expose native ACP commands and do not need separate adapter
-installs. The setup script also checks common agent tools including `rg`, `git`,
-`node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`,
-`uv`, `fd`, and `make`.
+the ACP adapters they need. Codex uses the maintained
+`@agentclientprotocol/codex-acp` package plus the current `@openai/codex`
+package. The Codex package selects its published macOS binary for the current
+CPU; the user does not compile an ACP adapter. Claude's adapter is installed from
+npm, while Gemini and OpenCode expose native ACP commands and need no separate
+adapter. The setup script also checks common agent tools.
 
-### Prebuilt Codex ACP
+### Codex ACP Updates
 
-OmniHarness avoids compiling `codex-acp` with host Rust by default. In `auto`
-mode, the installer downloads the matching release asset:
+Normal `./omniharness` startup checks the managed Codex ACP and Codex CLI package
+versions and rolls both forward when npm publishes an update. Force an immediate
+refresh with:
 
-```text
-codex-acp-darwin-arm64
-codex-acp-darwin-x64
-codex-acp-linux-arm64
-codex-acp-linux-x64
-codex-acp-windows-x64.exe
+```bash
+scripts/install-agent-acp.sh --codex-acp=npm
 ```
 
 Useful overrides:
 
 ```bash
-OMNIHARNESS_CODEX_ACP_INSTALL=binary
-OMNIHARNESS_CODEX_ACP_RELEASE_REPO=danduma/omniharness
-OMNIHARNESS_CODEX_ACP_RELEASE_TAG=codex-acp-latest
-OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL=https://github.com/danduma/omniharness/releases/download/codex-acp-latest
+OMNIHARNESS_CODEX_ACP_INSTALL=npm
+OMNIHARNESS_CODEX_ACP_NPM_ROOT=/custom/package/root
 OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
 ```
 
-On Windows, use the PowerShell installer to download `codex-acp.exe` into
-`%LOCALAPPDATA%\OmniHarness\bin`:
-
-```powershell
-powershell -ExecutionPolicy Bypass -File scripts\install-agent-acp.ps1 -AddToPath
-```
-
-Git Bash/MSYS users can also run `scripts/install-agent-acp.sh`; it installs
-the Windows release asset as `codex-acp.exe`.
-
-For local development against the Rust source, force Cargo mode:
+Cargo mode remains an explicit adapter-development override and is never used by
+normal installation:
 
 ```bash
 scripts/install-agent-acp.sh --codex-acp=cargo
@@ -312,8 +289,7 @@ scripts/install-agent-acp.sh --codex-acp=cargo
 
 ### Docker-backed Codex ACP
 
-If the prebuilt binary cannot run on a machine, install a Docker-backed wrapper
-instead:
+If you deliberately want ACP isolation, install a Docker-backed wrapper instead:
 
 ```bash
 OMNIHARNESS_CODEX_ACP_INSTALL=docker ./omniharness
@@ -499,13 +475,10 @@ The command must print JSON:
 - **Unsupported pnpm version:** install pnpm 9 or newer, or run `./omniharness` from the repo root so the launcher can use Corepack's known-good default when available.
 - **Unsupported Node version:** use Node.js 22.13 or newer, but below Node.js 26. If you already installed dependencies with a different Node version, run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp`.
 - **Native SQLite binding errors:** run `pnpm rebuild better-sqlite3` under your current supported Node version.
-- **Windows Corepack `EPERM` under `C:\Program Files\nodejs`:** install pnpm into the user npm prefix with the PowerShell commands in Windows Quick Start, then open a new shell or update `$env:Path` for the current one.
-- **Windows install fails with `'cp' is not recognized` while building `@danduma/i18n`:** update to a checkout that pins `@danduma/i18n` to the Windows-compatible commit in `package.json`, then rerun `pnpm install`.
 - **`ERR_PNPM_IGNORED_BUILDS` mentions `node-pty`:** current checkouts allow the `node-pty` build in `pnpm-workspace.yaml`. If you are upgrading an older checkout, make sure `allowBuilds.node-pty` is `true`, then rerun `pnpm install`; use `pnpm approve-builds node-pty` only if pnpm still reports the build as pending approval.
-- **Windows startup fails with `spawn pnpm ENOENT` or `spawn EINVAL`:** update to a checkout that runs pnpm through the Windows command shell from the start scripts. As a temporary workaround, start `pnpm runner` and `pnpm dev:interface` from separate PowerShell windows.
 - **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.
 - **Port already in use:** stop the previous OmniHarness process, or set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT` before starting.
-- **`http://HOST:3050` times out from another machine:** confirm OmniHarness is listening on `0.0.0.0`, then allow inbound TCP traffic to that port in Windows Firewall and any hosting-provider firewall. Local `http://localhost:3050` can work even when external access is blocked.
+- **The private Tailscale URL times out:** run `tailscale status` and `tailscale serve status`, confirm the client device is in the same tailnet and permitted by its access rules, then restart `./omniharness` after setup.
 - **Phone pairing asks for auth:** set `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH` in `.env` and restart.
 
 ## Repository Layout
diff --git a/docs/deployment/runner-operations.md b/docs/deployment/runner-operations.md
index 833fd54..fca7369 100644
--- a/docs/deployment/runner-operations.md
+++ b/docs/deployment/runner-operations.md
@@ -80,6 +80,30 @@ The SQLite database and worker JSONL files are one consistency domain. Do not
 point two live runners at the same instance root. A second process refuses an
 owned runner lock. Separate instances need separate API ports and bridge URLs.
 
+## Private access with Tailscale
+
+Tailscale Serve is the preferred remote-access boundary for a Mac runner. From
+the repository root, run:
+
+```bash
+pnpm setup:tailscale
+```
+
+The setup command validates the connected tailnet, configures persistent private
+HTTPS proxying to `http://127.0.0.1:3050`, and manages only these ignored `.env`
+settings:
+
+```text
+OMNIHARNESS_PUBLIC_ORIGIN=https://device.tailnet.ts.net
+OMNIHARNESS_RUNNER_HOST=127.0.0.1
+```
+
+Restart `./omniharness`, check `tailscale serve status`, and open the printed URL
+from an allowed tailnet device. Use `pnpm setup:tailscale -- --dry-run` to inspect
+the operation, `--force` to preserve and replace conflicting origin/host values,
+or `--reset` to disable the owned HTTPS listener and remove its managed settings.
+The command never enables Funnel and never proxies port `7800`.
+
 ## TLS and reverse proxies
 
 The Node runner currently terminates HTTP. For any non-loopback deployment,
diff --git a/docs/security/authentication-and-tls.md b/docs/security/authentication-and-tls.md
index b76575b..c8dc56f 100644
--- a/docs/security/authentication-and-tls.md
+++ b/docs/security/authentication-and-tls.md
@@ -85,6 +85,18 @@ Browser/PWA clients rely on browser/OS certificate trust and cannot override a
 certificate warning from JavaScript. VS Code relies on the extension host's
 standard TLS trust.
 
+## Tailscale trust boundary
+
+Tailscale Serve is the preferred private HTTPS path for a Mac runner. Tailscale
+owns device identity, tailnet membership, access rules, MagicDNS, certificates,
+and Serve configuration. OmniHarness owns its password, sessions, public-origin
+setting, and loopback runner bind address.
+
+Tailnet access is defense in depth, not authentication for OmniHarness. Keep the
+OmniHarness password enabled, grant tailnet access narrowly, and never expose the
+ACP bridge on port `7800`. `pnpm setup:tailscale` uses Serve only; it never enables
+the public Tailscale Funnel feature.
+
 ## Trusted proxies and CORS
 
 Forwarded client/protocol headers are accepted only from
diff --git a/omniharness b/omniharness
index da6ad4a..92b2df4 100755
--- a/omniharness
+++ b/omniharness
@@ -160,7 +160,11 @@ else
   echo "[omniharness] Using pnpm ${CURRENT_PNPM_VERSION:-unknown} (minimum supported major: $MIN_PNPM_MAJOR; known-good default: $PNPM_VERSION)."
 fi
 
-if [ ! -d "$ROOT_DIR/node_modules" ] || [ ! -f "$ROOT_DIR/node_modules/.modules.yaml" ] || [ ! -d "$ROOT_DIR/node_modules/.pnpm" ]; then
+if [ ! -d "$ROOT_DIR/node_modules" ] \
+  || [ ! -f "$ROOT_DIR/node_modules/.modules.yaml" ] \
+  || [ ! -d "$ROOT_DIR/node_modules/.pnpm" ] \
+  || [ ! -f "$ROOT_DIR/node_modules/.pnpm/lock.yaml" ] \
+  || ! cmp -s "$ROOT_DIR/pnpm-lock.yaml" "$ROOT_DIR/node_modules/.pnpm/lock.yaml"; then
   echo "[omniharness] Installing dependencies with $PACKAGE_MANAGER..."
   env pnpm_config_dangerously_allow_all_builds=true "${PNPM_CMD[@]}" install
 fi
@@ -175,7 +179,7 @@ if [ "${OMNIHARNESS_SKIP_AGENT_ACP_SETUP:-0}" != "1" ]; then
   ./scripts/install-agent-acp.sh --ensure-only || echo "[omniharness] Agent ACP adapter setup reported issues; continuing." >&2
 fi
 
-WEB_PORT="${PORT:-3050}"
+WEB_PORT="${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}"
 LOCAL_URL="http://localhost:${WEB_PORT}"
 
 local_omniharness_status() {
@@ -262,12 +266,10 @@ NODE
 }
 
 print_tunnel_guidance() {
-  echo "[omniharness] Remote/tunnel setup:"
-  echo "  1. Expose only the web UI port, for example:"
-  echo "     cloudflared tunnel --url http://localhost:${WEB_PORT}"
-  echo "  2. Copy the generated https://... URL into .env:"
-  echo "     OMNIHARNESS_PUBLIC_ORIGIN=https://your-tunnel-url"
-  echo "  3. Restart ./omniharness so pairing links and public URLs use the tunnel."
+  echo "[omniharness] Private remote access (recommended):"
+  echo "  pnpm setup:tailscale"
+  echo "  This exposes only the web/API port to devices allowed by your tailnet."
+  echo "[omniharness] Public internet access (optional): see the Cloudflare section in README.md."
 }
 
 print_start_guidance() {
@@ -308,27 +310,17 @@ if [ "$CURRENT_STATUS" = "configuration_error" ]; then
   exit 1
 fi
 
-# A production `next start` needs a complete production build in .next. Running
-# `pnpm dev` (next dev --turbo) writes dev-shaped manifests into the same .next
-# directory, leaving BUILD_ID intact but clobbering routes-manifest.json so it
-# lacks `dataRoutes` -> `next start` then crashes with
-# "routesManifest.dataRoutes is not iterable". So validate the manifest, not just
-# the presence of BUILD_ID, before deciding whether to skip the build.
-needs_production_build() {
-  [ -f "$ROOT_DIR/.next/BUILD_ID" ] || return 0
-  node --input-type=module -e '
-    import { readFileSync } from "node:fs";
-    try {
-      const m = JSON.parse(readFileSync(process.argv[1], "utf8"));
-      process.exit(Array.isArray(m.dataRoutes) ? 0 : 1);
-    } catch { process.exit(1); }
-  ' "$ROOT_DIR/.next/routes-manifest.json" || return 0
-  return 1
-}
-
-if needs_production_build; then
-  echo "[omniharness] Building production server..."
+if node ./scripts/interface-build-state.mjs --check; then
+  :
+else
+  BUILD_STATE_EXIT=$?
+  if [ "$BUILD_STATE_EXIT" -ne 10 ]; then
+    echo "[omniharness] Could not inspect the production interface build." >&2
+    exit "$BUILD_STATE_EXIT"
+  fi
+  echo "[omniharness] Building production interface..."
   "${PNPM_CMD[@]}" build
+  node ./scripts/interface-build-state.mjs --write
 fi
 
 print_start_guidance
diff --git a/package.json b/package.json
index 45215a3..81c4e1a 100644
--- a/package.json
+++ b/package.json
@@ -18,15 +18,16 @@
     "predev": "node ./scripts/check-pnpm.mjs --verify-native",
     "dev": "pnpm exec tsx scripts/dev.ts",
     "dev:interface": "vite --config apps/interface/vite.config.ts --mode web",
-    "runner": "node --import tsx scripts/runner.ts",
+    "runner": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
     "auth:password": "node ./scripts/auth-password.mjs",
     "restart:control": "pnpm exec tsx scripts/remote-restart.ts",
     "prebuild": "node ./scripts/check-pnpm.mjs --verify-native",
     "setup:agents": "./scripts/install-agent-acp.sh",
+    "setup:tailscale": "node ./scripts/setup-tailscale.mjs",
     "build": "pnpm build:interface:web",
     "build:interface:web": "vite build --config apps/interface/vite.config.ts --mode web",
     "build:interface:packaged": "vite build --config apps/interface/vite.config.ts --mode packaged",
-    "start": "node --import tsx scripts/runner.ts",
+    "start": "node --env-file-if-exists=.env --import tsx scripts/runner.ts",
     "lint": "eslint",
     "typecheck": "tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.runner.json --noEmit && tsc -p tsconfig.interface.json --noEmit && tsc --noEmit",
     "test": "vitest run",
diff --git a/scripts/runner.ts b/scripts/runner.ts
index 7d95eb4..f428066 100644
--- a/scripts/runner.ts
+++ b/scripts/runner.ts
@@ -2,9 +2,27 @@
 import fs from "node:fs";
 import { resolveRunnerConfig } from "../src/server/runner/config";
 
+const RUNNER_HELP = `Usage: pnpm runner -- [options]
+
+Options:
+  --host <address>               API and interface bind address (default: 0.0.0.0)
+  --port <0-65535>               API and interface port (default: 3050)
+  --bridge-url <url>             Loopback ACP bridge URL (default: http://127.0.0.1:7800)
+  --static-dir <directory>       Serve an explicit built interface directory
+  --no-static                    Start the API without a production interface
+  --interface-dev-url <url>      Proxy interface requests to a Vite development server
+  -h, --help                     Show this help
+`;
+
 async function main() {
+  const rawArgv = process.argv.slice(2);
+  const argv = rawArgv[0] === "--" ? rawArgv.slice(1) : rawArgv;
+  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) {
+    process.stdout.write(RUNNER_HELP);
+    return;
+  }
   const config = resolveRunnerConfig({
-    argv: process.argv.slice(2),
+    argv,
     cwd: process.cwd(),
     env: process.env,
   });
diff --git a/tests/scripts/omniharness-launcher.test.ts b/tests/scripts/omniharness-launcher.test.ts
index 5230cba..83cbc4b 100644
--- a/tests/scripts/omniharness-launcher.test.ts
+++ b/tests/scripts/omniharness-launcher.test.ts
@@ -3,6 +3,9 @@ import path from "node:path";
 import { describe, expect, it } from "vitest";
 
 const launcherSource = readFileSync(path.resolve(process.cwd(), "omniharness"), "utf8");
+const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as {
+  scripts: Record<string, string>;
+};
 
 describe("omniharness launcher", () => {
   it("passes pnpm's package-manager mismatch policy through nested git dependency installs", () => {
@@ -19,4 +22,31 @@ describe("omniharness launcher", () => {
     expect(launcherSource).toContain("trap 'print_auth_password_notice; cleanup_auth_password_notice' EXIT");
     expect(launcherSource).toContain("print_start_guidance\nprint_auth_password_notice\nopen_browser_when_ready");
   });
+
+  it("loads the ignored local env file before resolving runner configuration", () => {
+    expect(packageJson.scripts.runner).toContain("--env-file-if-exists=.env");
+    expect(packageJson.scripts.start).toContain("--env-file-if-exists=.env");
+  });
+
+  it("reinstalls dependencies when the repository lockfile changed", () => {
+    expect(launcherSource).toContain('cmp -s "$ROOT_DIR/pnpm-lock.yaml" "$ROOT_DIR/node_modules/.pnpm/lock.yaml"');
+  });
+
+  it("uses the Vite interface build marker instead of the removed Next build", () => {
+    expect(launcherSource).toContain("scripts/interface-build-state.mjs --check");
+    expect(launcherSource).toContain("scripts/interface-build-state.mjs --write");
+    expect(launcherSource).not.toContain(".next/BUILD_ID");
+    expect(launcherSource).not.toContain(".next/routes-manifest.json");
+  });
+
+  it("recommends private Tailscale access before public tunnels", () => {
+    const tailscaleIndex = launcherSource.indexOf("pnpm setup:tailscale");
+    const publicTunnelIndex = launcherSource.indexOf("Public internet access");
+    expect(tailscaleIndex).toBeGreaterThan(-1);
+    expect(publicTunnelIndex).toBeGreaterThan(tailscaleIndex);
+  });
+
+  it("uses the same configured web port for readiness, browser, and runner startup", () => {
+    expect(launcherSource).toContain('WEB_PORT="${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}"');
+  });
 });


--- NEW FILE scripts/interface-build-state.mjs ---
#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MARKER_VERSION = 1;
const BUILD_REQUIRED_EXIT = 10;
const INPUT_PATHS = [
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "tsconfig.interface.json",
  "tsconfig.shared.json",
  "apps/interface",
  "shared/locales",
  "src/components",
  "src/interface",
  "src/lib",
  "src/runtime-api",
  "src/shared",
  "src/ui",
];

function readArgs(argv) {
  let mode = null;
  let root = process.cwd();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check" || arg === "--write") {
      if (mode) throw new TypeError("Use exactly one of --check or --write.");
      mode = arg;
      continue;
    }
    if (arg === "--root") {
      const value = argv[index + 1];
      if (!value) throw new TypeError("--root requires a directory.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new TypeError(`Unknown interface build-state option: ${arg}`);
  }
  if (!mode) throw new TypeError("Use --check or --write.");
  return { mode, root };
}

async function collectFiles(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  let stat;
  try {
    stat = await fs.stat(absolutePath);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }
  if (stat.isFile()) return [relativePath];
  if (!stat.isDirectory()) return [];

  const entries = await fs.readdir(absolutePath, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".DS_Store") continue;
    files.push(...await collectFiles(root, path.join(relativePath, entry.name)));
  }
  return files;
}

async function fingerprintInputs(root) {
  const hash = createHash("sha256");
  const files = [];
  for (const inputPath of INPUT_PATHS) {
    files.push(...await collectFiles(root, inputPath));
  }
  files.sort((left, right) => left.localeCompare(right));
  if (files.length === 0) throw new Error("No interface build inputs were found.");
  for (const relativePath of files) {
    hash.update(relativePath.split(path.sep).join("/"));
    hash.update("\0");
    hash.update(await fs.readFile(path.join(root, relativePath)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function validateOutput(root) {
  const outputDir = path.join(root, "dist", "interface");
  const indexPath = path.join(outputDir, "index.html");
  let html;
  try {
    html = await fs.readFile(indexPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { ok: false, reason: "production interface is missing" };
    }
    throw error;
  }

  const references = [...html.matchAll(/(?:src|href)=["']\/?(assets\/[^"'#?]+)["']/g)]
    .map((match) => match[1]);
  if (references.length === 0) {
    return { ok: false, reason: "production interface has no referenced assets" };
  }
  for (const reference of references) {
    try {
      const stat = await fs.stat(path.join(outputDir, reference));
      if (!stat.isFile()) throw new Error("not a file");
    } catch {
      return { ok: false, reason: `referenced asset is missing: ${reference}` };
    }
  }
  return { ok: true, outputDir };
}

async function readMarker(outputDir) {
  try {
    return JSON.parse(await fs.readFile(path.join(outputDir, ".build-state.json"), "utf8"));
  } catch {
    return null;
  }
}

async function check(root) {
  const output = await validateOutput(root);
  if (!output.ok) return output.reason;
  const marker = await readMarker(output.outputDir);
  if (marker?.version !== MARKER_VERSION || typeof marker.fingerprint !== "string") {
    return "build marker is missing or invalid";
  }
  const fingerprint = await fingerprintInputs(root);
  if (marker.fingerprint !== fingerprint) return "source fingerprint changed";
  return null;
}

async function write(root) {
  const output = await validateOutput(root);
  if (!output.ok) throw new Error(output.reason);
  const markerPath = path.join(output.outputDir, ".build-state.json");
  const temporaryPath = `${markerPath}.tmp-${process.pid}`;
  const marker = {
    version: MARKER_VERSION,
    fingerprint: await fingerprintInputs(root),
  };
  await fs.writeFile(temporaryPath, `${JSON.stringify(marker, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, markerPath);
  process.stdout.write(`[omniharness] Recorded interface build ${marker.fingerprint.slice(0, 12)}.\n`);
}

async function main() {
  const { mode, root } = readArgs(process.argv.slice(2));
  if (mode === "--write") {
    await write(root);
    return;
  }
  const reason = await check(root);
  if (reason) {
    process.stdout.write(`[omniharness] Interface build required: ${reason}.\n`);
    process.exit(BUILD_REQUIRED_EXIT);
  }
  process.stdout.write("[omniharness] Production interface is current.\n");
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

--- NEW FILE scripts/setup-tailscale.mjs ---
#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MANAGED_START = "# omniharness-tailscale-managed:start";
const MANAGED_END = "# omniharness-tailscale-managed:end";
const OWNED_KEYS = ["OMNIHARNESS_PUBLIC_ORIGIN", "OMNIHARNESS_RUNNER_HOST"];

function readArgs(argv) {
  if (argv[0] === "--") argv = argv.slice(1);
  const options = {
    root: process.cwd(),
    port: Number(process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || "3050"),
    dryRun: false,
    force: false,
    reset: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root" || arg === "--port") {
      const value = argv[index + 1];
      if (!value) throw new TypeError(`${arg} requires a value.`);
      if (arg === "--root") options.root = path.resolve(value);
      else options.port = Number(value);
      index += 1;
      continue;
    }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--reset") options.reset = true;
    else throw new TypeError(`Unknown Tailscale setup option: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) {
    throw new TypeError("--port must be an integer from 1 to 65535.");
  }
  return options;
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function findTailscale() {
  const explicit = process.env.OMNIHARNESS_TAILSCALE_BIN?.trim();
  if (explicit) return isExecutable(explicit) ? explicit : null;
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, "tailscale");
    if (isExecutable(candidate)) return candidate;
  }
  for (const candidate of [
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    "/Applications/Tailscale.app/Contents/MacOS/tailscale",
  ]) {
    if (isExecutable(candidate)) return candidate;
  }
  return null;
}

function invoke(tailscale, args, options = {}) {
  const result = spawnSync(tailscale, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = (result.stderr || result.stdout || `exit ${result.status}`).trim();
    throw new Error(`${detail}\nTailscale Serve may require an administrator, a configured operator, and HTTPS enabled for the tailnet.`);
  }
  return result;
}

function readTailnetStatus(tailscale) {
  const result = invoke(tailscale, ["status", "--json"]);
  let status;
  try {
    status = JSON.parse(result.stdout);
  } catch {
    throw new Error("Tailscale returned invalid status JSON.");
  }
  if (status.BackendState !== "Running") {
    throw new Error(`Tailscale is not connected (state: ${status.BackendState || "unknown"}). Run \`tailscale up\`, then retry.`);
  }
  const dnsName = String(status.Self?.DNSName || "").replace(/\.$/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.ts\.net$/.test(dnsName)) {
    throw new Error("Tailscale status did not provide a valid tailnet DNS name. Ensure MagicDNS and HTTPS are enabled for the tailnet.");
  }
  return { dnsName, origin: `https://${dnsName}` };
}

function removeManagedBlock(text) {
  const start = text.indexOf(MANAGED_START);
  if (start === -1) return text;
  const end = text.indexOf(MANAGED_END, start);
  if (end === -1) throw new Error("The OmniHarness Tailscale block in .env is incomplete; repair it before continuing.");
  let removeStart = start;
  if (removeStart > 0 && text[removeStart - 1] === "\n") removeStart -= 1;
  let removeEnd = end + MANAGED_END.length;
  if (text[removeEnd] === "\r") removeEnd += 1;
  if (text[removeEnd] === "\n") removeEnd += 1;
  return `${text.slice(0, removeStart)}${text.slice(removeEnd)}`;
}

function activeOwnedSettings(text) {
  const values = new Map();
  for (const line of removeManagedBlock(text).split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

function buildManagedEnv(text, settings, force) {
  const withoutManaged = removeManagedBlock(text);
  const existing = activeOwnedSettings(withoutManaged);
  const conflicts = OWNED_KEYS.filter((key) => {
    const current = existing.get(key);
    return current && current !== settings[key];
  });
  if (conflicts.length > 0 && !force) {
    const details = conflicts.map((key) => `${key}=${existing.get(key)}`).join(", ");
    throw new Error(`Existing remote-access settings would be replaced (${details}). Re-run with --force to preserve them as comments and continue.`);
  }

  const keptLines = [];
  const previousLines = [];
  for (const line of withoutManaged.split(/\r?\n/)) {
    const match = line.match(/^\s*(OMNIHARNESS_PUBLIC_ORIGIN|OMNIHARNESS_RUNNER_HOST)\s*=\s*(.*)\s*$/);
    if (!match) {
      keptLines.push(line);
      continue;
    }
    if (force && match[2] && match[2] !== settings[match[1]]) {
      previousLines.push(`# omniharness-tailscale-previous: ${match[1]}=${match[2]}`);
    }
  }
  while (keptLines.at(-1) === "") keptLines.pop();
  const base = [...keptLines, ...previousLines].join("\n");
  const block = [
    MANAGED_START,
    `OMNIHARNESS_PUBLIC_ORIGIN=${settings.OMNIHARNESS_PUBLIC_ORIGIN}`,
    `OMNIHARNESS_RUNNER_HOST=${settings.OMNIHARNESS_RUNNER_HOST}`,
    MANAGED_END,
  ].join("\n");
  return `${base ? `${base}\n\n` : ""}${block}\n`;
}

function resetManagedEnv(text) {
  return removeManagedBlock(text).replace(/\n{2,}$/g, "\n");
}

async function readEnv(envPath) {
  try {
    return await fsp.readFile(envPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

async function stageEnv(envPath, text) {
  await fsp.mkdir(path.dirname(envPath), { recursive: true });
  const temporaryPath = `${envPath}.omniharness-tailscale.tmp-${process.pid}`;
  await fsp.writeFile(temporaryPath, text, { encoding: "utf8", mode: 0o600 });
  await fsp.chmod(temporaryPath, 0o600);
  return temporaryPath;
}

function inspectServeState(tailscale, target, force) {
  const result = invoke(tailscale, ["serve", "status", "--json"], { allowFailure: true });
  if (result.status !== 0 || !result.stdout.trim()) return;
  try {
    const status = JSON.parse(result.stdout);
    if (Object.keys(status).length > 0 && !JSON.stringify(status).includes(target) && !force) {
      throw new Error("Tailscale already has Serve configuration on this device. Re-run with --force only if OmniHarness may replace the default HTTPS listener.");
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

async function setup(options, tailscale) {
  const { origin } = readTailnetStatus(tailscale);
  const target = `http://127.0.0.1:${options.port}`;
  inspectServeState(tailscale, target, options.force);
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  const nextEnv = buildManagedEnv(currentEnv, {
    OMNIHARNESS_PUBLIC_ORIGIN: origin,
    OMNIHARNESS_RUNNER_HOST: "127.0.0.1",
  }, options.force);

  if (options.dryRun) {
    process.stdout.write(`[omniharness] Would run: tailscale serve --bg ${target}\n`);
    process.stdout.write(`[omniharness] Would configure private origin: ${origin}\n`);
    return;
  }

  const stagedPath = await stageEnv(envPath, nextEnv);
  try {
    invoke(tailscale, ["serve", "--bg", target]);
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    throw error;
  }
  try {
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    const rollback = invoke(tailscale, ["serve", "--https=443", "off"], { allowFailure: true });
    await fsp.rm(stagedPath, { force: true });
    const rollbackDetail = rollback.status === 0 ? "The new Serve listener was disabled." : `Serve rollback also failed: ${(rollback.stderr || rollback.stdout).trim()}`;
    throw new Error(`Tailscale Serve was configured, but .env could not be published. ${rollbackDetail}\n${error instanceof Error ? error.message : String(error)}`);
  }
  process.stdout.write(`[omniharness] Private OmniHarness URL: ${origin}\n`);
  process.stdout.write("[omniharness] Restart ./omniharness so the runner binds to loopback and uses this origin.\n");
}

async function reset(options, tailscale) {
  const envPath = path.join(options.root, ".env");
  const currentEnv = await readEnv(envPath);
  const nextEnv = resetManagedEnv(currentEnv);
  if (options.dryRun) {
    process.stdout.write("[omniharness] Would run: tailscale serve --https=443 off\n");
    process.stdout.write("[omniharness] Would remove the managed OmniHarness Tailscale settings from .env.\n");
    return;
  }
  const stagedPath = await stageEnv(envPath, nextEnv);
  try {
    invoke(tailscale, ["serve", "--https=443", "off"]);
    await fsp.rename(stagedPath, envPath);
  } catch (error) {
    await fsp.rm(stagedPath, { force: true });
    throw error;
  }
  process.stdout.write("[omniharness] Disabled the OmniHarness HTTPS Serve listener and removed its managed .env settings.\n");
}

async function main() {
  const options = readArgs(process.argv.slice(2));
  const tailscale = findTailscale();
  if (!tailscale) {
    throw new Error("Tailscale is not installed or its CLI is unavailable. Install the recommended standalone Mac app: https://tailscale.com/download/mac");
  }
  if (options.reset) await reset(options, tailscale);
  else await setup(options, tailscale);
}

main().catch((error) => {
  process.stderr.write(`[omniharness] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});

--- NEW FILE .github/workflows/install-smoke.yml ---
name: Verify macOS installation

on:
  push:
    branches: [master]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: macos-install-${{ github.ref }}
  cancel-in-progress: true

jobs:
  macos-install:
    name: Fresh Mac launcher
    runs-on: macos-15
    timeout-minutes: 20
    env:
      OMNIHARNESS_AUTH_PASSWORD: macos-release-smoke-password
      OMNIHARNESS_ROOT: ${{ runner.temp }}/omniharness-install-smoke
      OMNIHARNESS_RUNNER_HOST: 127.0.0.1
      OMNIHARNESS_RUNNER_PORT: 3059
      OMNIHARNESS_BRIDGE_URL: http://127.0.0.1:17809
      OMNIHARNESS_OPEN_BROWSER: 0
      OMNIHARNESS_SKIP_RECOMMENDED_TOOLS: 1

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup supported Node
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc

      - name: Confirm this is a fresh interface install
        run: test ! -e dist/interface/.build-state.json

      - name: Start through the real Mac launcher
        run: |
          ./omniharness > "$RUNNER_TEMP/omniharness-install.log" 2>&1 &
          echo "$!" > "$RUNNER_TEMP/omniharness-install.pid"

      - name: Wait for API health
        run: |
          node --input-type=module <<'NODE'
          const deadline = Date.now() + 120_000;
          const url = "http://127.0.0.1:3059/api/healthz";
          while (Date.now() < deadline) {
            try {
              const response = await fetch(url);
              if (response.ok) process.exit(0);
            } catch {}
            await new Promise((resolve) => setTimeout(resolve, 750));
          }
          throw new Error(`Timed out waiting for ${url}`);
          NODE

      - name: Verify production interface and build marker
        run: |
          node --input-type=module <<'NODE'
          import fs from "node:fs";
          const origin = "http://127.0.0.1:3059";
          const response = await fetch(origin);
          if (!response.ok) throw new Error(`Interface returned ${response.status}`);
          const html = await response.text();
          if (!html.includes("OmniHarness")) throw new Error("Response is not the OmniHarness interface");
          const assetPath = html.match(/(?:src|href)=["'](\/assets\/[^"'#?]+)["']/)?.[1];
          if (!assetPath) throw new Error("Interface HTML references no hashed asset");
          const assetResponse = await fetch(new URL(assetPath, origin));
          if (!assetResponse.ok) throw new Error(`Interface asset returned ${assetResponse.status}: ${assetPath}`);
          const marker = JSON.parse(fs.readFileSync("dist/interface/.build-state.json", "utf8"));
          if (marker.version !== 1 || !/^[a-f0-9]{64}$/.test(marker.fingerprint)) {
            throw new Error("Interface build marker is invalid");
          }
          NODE

      - name: Show launcher log on failure
        if: failure()
        run: test ! -f "$RUNNER_TEMP/omniharness-install.log" || tail -n 300 "$RUNNER_TEMP/omniharness-install.log"

      - name: Upload launcher log on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: macos-install-log
          path: ${{ runner.temp }}/omniharness-install.log

      - name: Stop isolated runner
        if: always()
        run: |
          if test -f "$RUNNER_TEMP/omniharness-install.pid"; then
            install_pid="$(cat "$RUNNER_TEMP/omniharness-install.pid")"
            if test -n "$install_pid" && kill -0 "$install_pid" 2>/dev/null; then
              kill "$install_pid"
              wait "$install_pid" 2>/dev/null || true
            fi
          fi

--- NEW FILE tests/scripts/interface-build-state.test.ts ---
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(process.cwd(), "scripts/interface-build-state.mjs");
const tempRoots: string[] = [];

function createFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-interface-state-"));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, "apps", "interface"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "interface"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"fixture"}\n');
  fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  fs.writeFileSync(path.join(root, "apps", "interface", "index.html"), "<div id=\"root\"></div>\n");
  fs.writeFileSync(path.join(root, "src", "interface", "main.ts"), "export const version = 1;\n");
  return root;
}

function run(root: string, flag: "--check" | "--write") {
  return spawnSync(process.execPath, [scriptPath, flag, "--root", root], {
    encoding: "utf8",
  });
}

function writeBuiltInterface(root: string) {
  const output = path.join(root, "dist", "interface");
  fs.mkdirSync(path.join(output, "assets"), { recursive: true });
  fs.writeFileSync(
    path.join(output, "index.html"),
    '<!doctype html><script type="module" src="/assets/index-abc123.js"></script>',
  );
  fs.writeFileSync(path.join(output, "assets", "index-abc123.js"), "console.log('ready');\n");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("interface build state", () => {
  it("requires a build when the interface output is missing", () => {
    const result = run(createFixture(), "--check");
    expect(result.status).toBe(10);
    expect(result.stdout).toContain("build required");
  });

  it("accepts a complete output only after writing its matching source fingerprint", () => {
    const root = createFixture();
    writeBuiltInterface(root);

    expect(run(root, "--check").status).toBe(10);
    expect(run(root, "--write").status).toBe(0);
    expect(run(root, "--check").status).toBe(0);

    const marker = JSON.parse(
      fs.readFileSync(path.join(root, "dist", "interface", ".build-state.json"), "utf8"),
    ) as { version: number; fingerprint: string };
    expect(marker.version).toBe(1);
    expect(marker.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires another build when a source input changes", () => {
    const root = createFixture();
    writeBuiltInterface(root);
    expect(run(root, "--write").status).toBe(0);

    fs.writeFileSync(path.join(root, "src", "interface", "main.ts"), "export const version = 2;\n");
    const result = run(root, "--check");
    expect(result.status).toBe(10);
    expect(result.stdout).toContain("fingerprint changed");
  });

  it("refuses to bless output whose referenced asset is missing", () => {
    const root = createFixture();
    writeBuiltInterface(root);
    fs.rmSync(path.join(root, "dist", "interface", "assets", "index-abc123.js"));

    const result = run(root, "--write");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("referenced asset is missing");
  });
});

--- NEW FILE tests/scripts/runner-help.test.ts ---
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("runner help", () => {
  it("prints runner-specific options through pnpm without starting the server", () => {
    const result = spawnSync("pnpm", ["runner", "--", "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm runner -- [options]");
    expect(result.stdout).toContain("--static-dir <directory>");
    expect(result.stdout).toContain("--no-static");
    expect(result.stdout).toContain("--interface-dev-url <url>");
    expect(result.stdout).not.toContain("runner.ready");
  });
});

--- NEW FILE tests/scripts/setup-tailscale.test.ts ---
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = path.resolve(process.cwd(), "scripts/setup-tailscale.mjs");
const tempRoots: string[] = [];

function createFixture(options: { backendState?: string; dnsName?: string; serveFails?: boolean } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-tailscale-"));
  tempRoots.push(root);
  const binDir = path.join(root, "bin");
  const logPath = path.join(root, "tailscale.log");
  const tailscalePath = path.join(binDir, "tailscale");
  fs.mkdirSync(binDir, { recursive: true });
  fs.writeFileSync(tailscalePath, `#!/bin/sh
echo "$@" >> "$OMNI_TEST_TAILSCALE_LOG"
if [ "$1" = "status" ] && [ "$2" = "--json" ]; then
  printf '%s\n' "$OMNI_TEST_TAILSCALE_STATUS"
  exit 0
fi
if [ "$1" = "serve" ] && [ "$2" = "status" ] && [ "$3" = "--json" ]; then
  printf '{}\n'
  exit 0
fi
if [ "$OMNI_TEST_TAILSCALE_SERVE_FAILS" = "1" ]; then
  echo "Serve permission denied; configure an operator or administrator" >&2
  exit 1
fi
exit 0
`);
  fs.chmodSync(tailscalePath, 0o755);
  return {
    root,
    logPath,
    tailscalePath,
    env: {
      ...process.env,
      OMNIHARNESS_TAILSCALE_BIN: tailscalePath,
      OMNI_TEST_TAILSCALE_LOG: logPath,
      OMNI_TEST_TAILSCALE_STATUS: JSON.stringify({
        BackendState: options.backendState ?? "Running",
        Self: { DNSName: options.dnsName ?? "studio.example-tailnet.ts.net." },
      }),
      OMNI_TEST_TAILSCALE_SERVE_FAILS: options.serveFails ? "1" : "0",
    },
  };
}

function run(
  fixture: ReturnType<typeof createFixture>,
  args: string[] = [],
  env: NodeJS.ProcessEnv = fixture.env,
) {
  return spawnSync(process.execPath, [scriptPath, "--root", fixture.root, ...args], {
    encoding: "utf8",
    env,
  });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("Tailscale private access setup", () => {
  it("accepts option forwarding through the documented pnpm command", () => {
    const fixture = createFixture();
    const result = spawnSync(
      "pnpm",
      ["setup:tailscale", "--", "--root", fixture.root, "--dry-run"],
      {
      cwd: process.cwd(),
      encoding: "utf8",
      env: fixture.env,
      },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Would run: tailscale serve --bg http://127.0.0.1:3050");
  });

  it("fails with an install link before changing anything when Tailscale is missing", () => {
    const fixture = createFixture();
    const result = run(fixture, [], {
      ...fixture.env,
      OMNIHARNESS_TAILSCALE_BIN: path.join(fixture.root, "missing-tailscale"),
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("https://tailscale.com/download/mac");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("fails without invoking Serve when the Mac is not connected to a tailnet", () => {
    const fixture = createFixture({ backendState: "Stopped" });
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("tailscale up");
    expect(fs.readFileSync(fixture.logPath, "utf8")).toBe("status --json\n");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("shows the exact private Serve change in dry-run mode without mutating state", () => {
    const fixture = createFixture();
    const result = run(fixture, ["--dry-run"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("https://studio.example-tailnet.ts.net");
    expect(result.stdout).toContain("tailscale serve --bg http://127.0.0.1:3050");
    expect(fs.readFileSync(fixture.logPath, "utf8")).toBe("status --json\nserve status --json\n");
    expect(fs.existsSync(path.join(fixture.root, ".env"))).toBe(false);
  });

  it("configures private Serve and atomically writes owned OmniHarness settings", () => {
    const fixture = createFixture();
    fs.writeFileSync(path.join(fixture.root, ".env"), "EXISTING_SETTING=kept\n");
    const result = run(fixture);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.logPath, "utf8")).toContain(
      "serve --bg http://127.0.0.1:3050",
    );
    expect(fs.readFileSync(path.join(fixture.root, ".env"), "utf8")).toBe(
      "EXISTING_SETTING=kept\n\n"
      + "# omniharness-tailscale-managed:start\n"
      + "OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\n"
      + "OMNIHARNESS_RUNNER_HOST=127.0.0.1\n"
      + "# omniharness-tailscale-managed:end\n",
    );
  });

  it("refuses to replace an existing public or LAN deployment without --force", () => {
    const fixture = createFixture();
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\n",
    );
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("--force");
    expect(fs.readFileSync(envPath, "utf8")).toContain("https://public.example.com");
    expect(fs.readFileSync(fixture.logPath, "utf8")).not.toContain("serve --bg");
  });

  it("preserves overridden values as comments when --force is explicit", () => {
    const fixture = createFixture();
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com\nOMNIHARNESS_RUNNER_HOST=0.0.0.0\n",
    );
    const result = run(fixture, ["--force"]);

    expect(result.status).toBe(0);
    const envText = fs.readFileSync(envPath, "utf8");
    expect(envText).toContain("# omniharness-tailscale-previous: OMNIHARNESS_PUBLIC_ORIGIN=https://public.example.com");
    expect(envText).toContain("# omniharness-tailscale-previous: OMNIHARNESS_RUNNER_HOST=0.0.0.0");
    expect(envText).toContain("OMNIHARNESS_RUNNER_HOST=127.0.0.1");
  });

  it("leaves .env unchanged when Tailscale refuses Serve configuration", () => {
    const fixture = createFixture({ serveFails: true });
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(envPath, "EXISTING_SETTING=kept\n");
    const result = run(fixture);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Serve permission denied");
    expect(result.stderr).toContain("administrator");
    expect(fs.readFileSync(envPath, "utf8")).toBe("EXISTING_SETTING=kept\n");
    expect(fs.readdirSync(fixture.root).filter((name) => name.includes("tailscale.tmp"))).toEqual([]);
  });

  it("removes only managed settings and disables the owned HTTPS listener on reset", () => {
    const fixture = createFixture();
    const envPath = path.join(fixture.root, ".env");
    fs.writeFileSync(
      envPath,
      "EXISTING_SETTING=kept\n\n"
      + "# omniharness-tailscale-managed:start\n"
      + "OMNIHARNESS_PUBLIC_ORIGIN=https://studio.example-tailnet.ts.net\n"
      + "OMNIHARNESS_RUNNER_HOST=127.0.0.1\n"
      + "# omniharness-tailscale-managed:end\n",
    );
    const result = run(fixture, ["--reset"]);

    expect(result.status).toBe(0);
    expect(fs.readFileSync(fixture.logPath, "utf8")).toContain("serve --https=443 off");
    expect(fs.readFileSync(envPath, "utf8")).toBe("EXISTING_SETTING=kept\n");
  });
});

--- NEW FILE tests/scripts/mac-install-workflow.test.ts ---
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

describe("macOS clean installation release check", () => {
  it("runs the real launcher and verifies health, HTML, an asset, and the build marker", () => {
    const workflowPath = path.resolve(process.cwd(), ".github/workflows/install-smoke.yml");
    const source = fs.readFileSync(workflowPath, "utf8");
    const workflow = yaml.load(source) as { jobs?: Record<string, { "runs-on"?: string }> };

    expect(workflow.jobs?.["macos-install"]?.["runs-on"]).toBe("macos-15");
    expect(source).toContain("./omniharness");
    expect(source).toContain("OMNIHARNESS_AUTH_PASSWORD");
    expect(source).toContain("OMNIHARNESS_RUNNER_PORT: 3059");
    expect(source).toContain("/api/healthz");
    expect(source).toContain("dist/interface/.build-state.json");
    expect(source).toContain("assetPath");
    expect(source).toContain("if: always()");
  });
});


uuid: 27f75c21-d3ef-48e9-bab0-aa2bead6dcde

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:58:33.041Z","phase":null} -->
## Claude attachment · 2026-08-05T20:58:33.041Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-a-tool-free-functional-hellman.md",
  "planExists": false
}

binary omitted from archive

uuid: 2ac0fbe5-b543-408e-bdaf-6735c17c7d9d
parent: 27f75c21-d3ef-48e9-bab0-aa2bead6dcde
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-05T21:01:01.782Z","phase":null} -->
## Claude thinking · 2026-08-05T21:01:01.782Z



uuid: 6b16b90b-fa4f-4d68-baaf-dcad2a59ca0c
parent: 2ac0fbe5-b543-408e-bdaf-6735c17c7d9d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T21:02:02.579Z","phase":null} -->
## Claude · 2026-08-05T21:02:02.579Z

## 1. Verdict

**FIX** — the release path is close, but there are correctness, destructive-behavior, and false-documentation issues that matter for a "Mac-first install" gate.

---

## 2. Critical / important issues

### C1. `.env` is loaded by the runner but not by the launcher or the Tailscale setup — port desync
`package.json` adds `--env-file-if-exists=.env` to `runner`/`start`, so the **runner's** port comes from `.env`. But:

- `omniharness` computes `WEB_PORT="${OMNIHARNESS_RUNNER_PORT:-${PORT:-3050}}"` from the *shell* environment only. With `OMNIHARNESS_RUNNER_PORT=4000` in `.env` (documented in `.env.example`), the launcher polls readiness and opens the browser on 3050 while the runner binds 4000 → launcher reports failure / opens a dead URL.
- `scripts/setup-tailscale.mjs` reads `process.env.OMNIHARNESS_RUNNER_PORT || process.env.PORT || 3050` with no `.env` load, so it will run `tailscale serve --bg http://127.0.0.1:3050` against a runner listening elsewhere — a silently broken private URL.

**Fix:** resolve the effective port once, from the same source of truth. Add a tiny `node --env-file-if-exists=.env -p` (or reuse `resolveRunnerConfig`) call in the launcher to compute `WEB_PORT`, and load `.env` in `setup-tailscale.mjs` (`process.loadEnvFile?.(envPath)` guarded by existence) before defaulting `options.port`. Also confirm `resolveRunnerConfig`'s precedence is `OMNIHARNESS_RUNNER_PORT` over `PORT`; if it is the reverse, the launcher's new expression is wrong for the both-set case.

Also note Node's `--env-file` **overrides** already-exported process env (unlike dotenv). `.env` will beat an explicit `OMNIHARNESS_RUNNER_HOST=…` exported in the shell — surprising, and worth one line in `.env.example`.

### C2. `--reset` and the rollback path can destroy unrelated Tailscale Serve config
Both `reset()` and the rename-failure rollback run `tailscale serve --https=443 off`, which disables the entire 443 listener, not "the OmniHarness one." Serve config is not owned or tagged anywhere. Consequences:

- A user with pre-existing Serve routes on 443 who runs `--force` then `--reset` loses their configuration; `--force` never restores it either.
- README/`docs/deployment/runner-operations.md` claim `--reset` "disables the OmniHarness HTTPS Serve listener" and "removes only managed settings" — false for the Serve half.

**Fix:** read `tailscale serve status --json` before mutating; store the previous config (or at least the fact that one existed) alongside the managed `.env` block. On `--reset`, only turn off when the current 443 handler proxies to exactly `http://127.0.0.1:<port>`; otherwise refuse with the actual current target printed. On rollback, restore the captured prior config via `tailscale serve set-raw`/re-apply rather than a blanket `off`. Until that exists, downgrade the doc wording.

### C3. `inspectServeState` can silently permit Funnel (public) exposure
The constraint is "no silent Funnel/public access," but the conflict check never inspects `AllowFunnel`. `tailscale serve --bg` attaches to the existing 443 serve config; if the device previously ran `tailscale funnel`, `AllowFunnel[":443"]` stays true and OmniHarness becomes **publicly reachable on the internet** with no warning. The README asserts "it never enables the public Tailscale Funnel feature" — technically true, and materially misleading.

**Fix:** parse the serve status JSON and hard-fail (even under `--force`) if any `AllowFunnel` entry is true for the target port; print the exact `tailscale funnel --https=443 off` remediation. Add a test with a stub emitting `{"AllowFunnel":{":443":true}}`.

### C4. `inspectServeState` conflict detection is both false-positive and false-negative prone
```js
if (result.status !== 0 || !result.stdout.trim()) return;      // silently skips the check
if (Object.keys(status).length > 0 && !JSON.stringify(status).includes(target) && !force) throw …
```
- Recent `tailscale serve status --json` emits a populated envelope (e.g. `{"TCP":null,"Web":null,"AllowFunnel":null}`) even with nothing configured. `Object.keys(...).length > 0` is then true and the target is absent → the command aborts on a **clean machine** with "already has Serve configuration." The test stubs `{}`, so it does not catch this.
- `JSON.stringify(status).includes("http://127.0.0.1:3050")` also matches `http://127.0.0.1:30500` → missed conflict.
- Any non-zero exit or empty output disables the safety check entirely, without telling the user.

**Fix:** inspect the specific `Web[":443"].Handlers` map and compare the `Proxy` value with strict equality; treat an unparseable/failed `serve status` as a hard error (or an explicit "could not verify existing Serve config; re-run with --force") rather than a silent pass.

### C5. `.env.example` now advertises `OMNIHARNESS_RUNNER_HOST=127.0.0.1` while the code default is `0.0.0.0`
The new runner help text in `scripts/runner.ts` says `--host … (default: 0.0.0.0)`, and README no longer contains any LAN/firewall guidance (the Windows section that carried it was deleted). So the shipped default is still "listen on every interface" while all the docs now imply loopback, and the only thing that actually sets loopback is `pnpm setup:tailscale`.

**Fix (recommended):** change the default bind in `src/server/runner/config.ts` to `127.0.0.1` for the Mac-first release and let `--host`/`OMNIHARNESS_RUNNER_HOST` opt into `0.0.0.0`. If you keep `0.0.0.0`, say so explicitly in `.env.example` and in `docs/security/authentication-and-tls.md`, because the new docs read as if loopback is the default.

### C6. `js-yaml` in `tests/scripts/mac-install-workflow.test.ts` is not added as a dependency
The diff adds `import yaml from "js-yaml"` but no `js-yaml`/`@types/js-yaml` devDependency. Under pnpm's isolated `node_modules`, a transitive copy will not resolve, so a clean install fails both `vitest` and `tsc`. **Fix:** add both to `devDependencies`, or drop the YAML parse (the test only uses it for one `runs-on` assertion and otherwise greps raw text).

### C7. Unchecked build/marker failures in the launcher
```sh
echo "[omniharness] Building production interface..."
"${PNPM_CMD[@]}" build
node ./scripts/interface-build-state.mjs --write
```
Neither result is checked in the diff. If the launcher does not run under `set -e`, a failed `vite build` falls through to `--write`, which will happily bless a **stale** `dist/interface` (it only validates that `index.html` and its referenced assets exist) and then start serving the old UI. **Fix:** `"${PNPM_CMD[@]}" build || { echo …; exit 1; }` and the same for `--write`, regardless of `set -e` status.

### C8. Doc claims that the diff does not substantiate
These need to be verified against `omniharness` and `scripts/install-agent-acp.sh` or reworded:
- "The launcher selects the repo version through `nvm` and installs `nvm` when necessary." Nothing in the shown launcher hunk does this; installing a Node version manager as a side effect of `./omniharness` is also a fairly invasive claim to make in the Requirements section.
- "Normal `./omniharness` startup checks the managed Codex ACP and Codex CLI package versions and rolls both forward when npm publishes an update." The launcher calls `install-agent-acp.sh --ensure-only`, whose name implies the opposite. If it really does hit the npm registry on every start, that is a startup-latency and offline-failure cost, and an unpinned auto-upgrade of a third-party package on every launch is a supply-chain footgun. Recommend: pin a known-good range, check at most once per N hours with a cached timestamp, and tolerate offline.

---

## 3. Minor observations

**Tests that overstate their claim** (you asked specifically):
- `omniharness-launcher.test.ts › "loads the ignored local env file before resolving runner configuration"` only greps `package.json` for a flag. It proves nothing about the launcher and is actively contradicted by C1.
- `"uses the same configured web port for readiness, browser, and runner startup"` asserts one string literal; it does not check that the runner resolves the port the same way. Rename to reflect what it checks, or make it an integration assertion.
- `mac-install-workflow.test.ts` greps `if: always()` and `assetPath` out of the raw YAML — it asserts that the workflow *file* mentions things, not that the smoke test works. This is a change-detector; consider trimming to the two structural assertions (`runs-on`, and that the cleanup step exists with `always()` via the parsed object).
- `runner-help.test.ts` infers "did not start the server" from the absence of `runner.ready` in stdout. Asserting the process exits 0 quickly and that nothing bound the port would be stronger.

**`scripts/setup-tailscale.mjs`:**
- `stageEnv` writes `.env.omniharness-tailscale.tmp-<pid>` into the repo root. Confirm `.gitignore` matches `.env*` and not just `.env`; otherwise a crash between stage and rename leaves an untracked secret-bearing file in the working tree (and violates the "preserve unrelated dirty changes" spirit).
- `spawnSync` has no `timeout`. A wedged `tailscaled` makes `tailscale status --json` hang forever. Add `timeout: 30_000` and handle `result.signal` (currently produces `exit null`).
- The "may require an administrator, a configured operator, and HTTPS enabled" hint is appended to *every* failure, including `status` failures where it is irrelevant.
- `--reset` on a repo with no `.env` creates an empty `.env`. Skip the write when the result is empty and the file did not exist.
- Repeated `--force` runs accumulate `# omniharness-tailscale-previous:` lines indefinitely.
- Non-conflicting owned keys are relocated to the bottom of `.env`, which changes last-wins semantics if the user had a later override.
- `--port --dry-run` consumes the flag as a value and fails with a confusing NaN error.
- Dry-run exits non-zero on an `.env` conflict, which contradicts README's "inspect without changing" framing. Fine behaviour; just worth a word in the docs.

**`scripts/interface-build-state.mjs`:**
- Vite mode files (`.env.production`, `VITE_*`) are not part of the fingerprint, so changing build-time env will not trigger a rebuild.
- `validateOutput`'s regex hardcodes `assets/`. If `assetsDir` or `base` ever changes, `--check` returns "no referenced assets" forever and `--write` throws — an unrecoverable launch loop. Prefer reading Vite's `manifest.json`, or at minimum fail loudly with the actual `index.html` head.
- `.build-state.json` lands inside the served static root and is therefore fetchable as `/.build-state.json`. Only a source-fingerprint oracle, but consider writing it to `dist/.interface-build-state.json` instead.
- `collectFiles` walks the full `src/components`/`src/interface`/`src/lib`/`src/ui` trees on every launch; fine today, but exclude `node_modules`/`dist` defensively.

**`omniharness`:**
- With `node-linker=hoisted`, `node_modules/.pnpm` does not exist, so both the pre-existing `-d .pnpm` check and the new `cmp` guard force a reinstall on every start. Guard the `cmp` on the file existing (already done) and consider tolerating the hoisted layout.

**CI (`install-smoke.yml`):**
- `OMNIHARNESS_SKIP_AGENT_ACP_SETUP` is not set, so every run installs `@agentclientprotocol/codex-acp` and `@openai/codex` from npm. That is real release-path coverage, but it makes the gate dependent on third-party registry availability. Consider a second, fast job with the skip flag set so a registry outage does not red-wall all PRs.
- The launcher may attempt nvm installation on the runner despite `actions/setup-node`; worth an explicit skip env if one exists.
- `kill "$install_pid"` targets the launcher shell only; the runner and ACP bridge children are orphaned. Harmless on ephemeral runners, misleading if this workflow is ever reused locally. `kill -- -"$pid"` with a process group (or `setsid`) is the durable form.
- `wait "$install_pid"` runs in a different shell than the one that backgrounded it, so it is always a no-op; the `|| true` hides that. Replace with a short `kill -0` poll loop if you want a real graceful-shutdown assertion — as written, the "clean shutdown" claim is not tested by CI.
- `test ! -e dist/interface/.build-state.json` on a fresh checkout is tautological.

**`scripts/runner.ts`:** `argv.length === 1 && ["--help","-h"].includes(argv[0])` means `--help --port 3050` falls through to config parsing. Use `argv.includes("--help") || argv.includes("-h")`.

uuid: 888047c5-c978-425c-9afe-2202482f5e74
parent: 6b16b90b-fa4f-4d68-baaf-dcad2a59ca0c

<!-- /codex-event -->
