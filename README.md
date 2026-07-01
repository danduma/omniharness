# OmniHarness

OmniHarness is a local control plane for supervising ACP-backed coding agents from a web UI, CLI, or another ACP client. It runs a Next.js app plus an in-repo agent runtime that owns Codex, Claude, Gemini, OpenCode, and other Agent Client Protocol workers.

Use it when you want one durable place to start coding-agent runs, watch worker output, recover conversations, inspect execution events, and keep local agent processes behind a clear supervisory layer.

## What You Get

- **Multi-agent supervision:** start implementation, planning, and direct-control conversations with supported ACP workers.
- **Live run visibility:** stream messages, worker output, execution events, and status changes while a run is active.
- **Durable local history:** persist runs, messages, workers, settings, auth records, and execution events in SQLite.
- **CLI parity:** launch and watch the same conversation modes from the terminal.
- **ACP server mode:** expose OmniHarness itself as an ACP agent over stdio for compatible clients.
- **Managed agent environment:** spawn workers with a practical `PATH` even when the app starts from a GUI, editor, or service manager.
- **Phone-friendly local UI:** run the web app as a local PWA for supervising work away from the terminal.

## Project Status

OmniHarness is early open-source software under active development. Expect sharp edges, fast-moving internals, and occasional database or workflow changes. The core local loop is the priority: reliable worker launch, observable agent activity, durable recovery, and straightforward developer setup.

## Requirements

- macOS, Linux, or Windows with a normal developer shell. On Windows, use PowerShell for the setup commands below.
- Node.js 22.13 or newer, up to but not including Node.js 26. If you use `nvm`, run `nvm use` from the repo root to select the recommended local version.
- pnpm 9 or newer. The `packageManager` field in `package.json` is a known-good Corepack default, not an exact-version requirement.
- `ripgrep` (`rg`) is recommended for fast agent repository search. The `./omniharness` launcher installs it automatically when a supported system package manager is available. Set `OMNIHARNESS_SKIP_RECOMMENDED_TOOLS=1` to skip recommended tool setup.
- At least one supported coding agent when you want to run real workers:
  - Codex CLI plus `codex-acp`
  - Claude CLI plus `claude-agent-acp`
  - Gemini CLI with native ACP mode
  - OpenCode with native ACP mode
- Docker, if you want OmniHarness to run `codex-acp` from a container instead
  of compiling the Rust adapter on the host.

## Quick Start

Clone the repo, enter it, and select the recommended Node version:

```bash
git clone <repo-url> omniharness
cd omniharness
nvm use
```

Start OmniHarness normally:

```bash
./omniharness
```

On first start, `./omniharness` asks you to create a web login password. Press
Enter to have it generate one for you. Generated passwords are printed once in
the terminal; save that password before continuing. The launcher stores only an
Argon2 hash in `.env`.

The launcher opens [http://localhost:3050](http://localhost:3050) when the local
server is ready. Set `OMNIHARNESS_OPEN_BROWSER=0` if you do not want it to open a
browser automatically.

`./omniharness` installs dependencies when needed, builds the production server
when needed, then starts both pieces OmniHarness needs:

- the Next.js web UI on `http://localhost:3050`
- the in-repo agent runtime on `http://127.0.0.1:7800`

### Windows Quick Start

Use PowerShell from the repo root. If Corepack can write to your Node.js
installation, enable the repo's package manager normally:

```powershell
corepack enable
corepack prepare pnpm@11.2.2 --activate
```

If Corepack fails with an `EPERM` error under `C:\Program Files\nodejs`, install
pnpm into the user npm prefix instead:

```powershell
$prefix = Join-Path $env:APPDATA "npm"
New-Item -ItemType Directory -Force -Path $prefix | Out-Null
npm config set prefix $prefix
$env:Path = "$prefix;$env:Path"
[Environment]::SetEnvironmentVariable("Path", "$prefix;$([Environment]::GetEnvironmentVariable("Path", "User"))", "User")
npm install -g pnpm@11.2.2
```

Then clone, install, build, and start:

```powershell
git clone <repo-url> omniharness
cd omniharness
pnpm install
Copy-Item .env.example .env
# Set OMNIHARNESS_AUTH_PASSWORD or OMNIHARNESS_AUTH_PASSWORD_HASH in .env.
pnpm build
$env:OMNIHARNESS_OPEN_BROWSER = "0"
pnpm start
```

The web UI listens on `http://localhost:3050` and the runtime listens on
`http://127.0.0.1:7800`. For browser access from another machine, allow inbound
TCP traffic to the web port in Windows Firewall and in any provider firewall, or
put OmniHarness behind a tunnel or reverse proxy. Do not expose the runtime port
directly to the public internet.

Run the separate restart control app if you want a small remote escape hatch
with its own password-gated interface:

```bash
pnpm restart:control
```

It listens on port `3099`. Open `http://localhost:3099` to see status, recent
logs, and buttons to start OmniHarness in dev or production mode. The web login
uses `OMNIHARNESS_AUTH_PASSWORD_HASH` or `OMNIHARNESS_AUTH_PASSWORD` when either
is configured, then falls back to `OMNIHARNESS_REMOTE_RESTART_PASSWORD`, then to
the generated token file.

To keep the restart controller alive across reboots even when macOS does not
auto-login, install the boot-time daemon:

```bash
./scripts/install-restarter.sh
```

It installs as a `LaunchDaemon` by default. If you explicitly want the older
login-session `LaunchAgent` behavior, set
`OMNIHARNESS_RESTART_LAUNCHD_SCOPE=user` before running the installer.

The script API creates `.omniharness/remote-restart-token` on first run and
accepts bearer auth:

```bash
curl -X POST "http://HOST:3099/restart?mode=dev" \
  -H "Authorization: Bearer $(cat .omniharness/remote-restart-token)"
```

Use `mode=prod` to launch `./omniharness` instead of `pnpm run dev`.

For phone access through Cloudflare Tunnel, expose the restart app as a second
hostname that points to `http://localhost:3099`, for example:

```yaml
ingress:
  - hostname: horse-battery-staple.omniharness.dev
    service: http://localhost:3050
  - hostname: restart-horse-battery-staple.omniharness.dev
    service: http://localhost:3099
  - service: http_status:404
```

## Optional Setup

Create a local env file only if you want password auth, phone pairing, public-origin links, or API-key based agent/model access:

```bash
cp .env.example .env
```

Local agent CLIs that are already logged in usually work without API keys. If you want the supervisor model or runtime workers to use provider keys from the environment, fill in the relevant variables in `.env`.

## Password Auth

OmniHarness requires a password before the web UI can create an authenticated session or pair a phone.

For the simplest local setup, run the launcher and follow the prompt:

```bash
./omniharness
```

If `.env` or the current shell already contains `OMNIHARNESS_AUTH_PASSWORD` or
`OMNIHARNESS_AUTH_PASSWORD_HASH`, the launcher keeps that existing configuration.

Change or reset the password from the repo root:

```bash
pnpm auth:password set
```

Pass the password as an argument when you need a one-line command:

```bash
pnpm auth:password set "new-password"
```

The command removes active `OMNIHARNESS_AUTH_PASSWORD` and
`OMNIHARNESS_AUTH_PASSWORD_HASH` lines from `.env`, then writes one fresh
Argon2 hash. Restart OmniHarness after changing the password.

Check or test the configured password:

```bash
pnpm auth:password status
pnpm auth:password verify "new-password"
```

Hash-only passwords cannot be printed back out. If `status` says the password is
hash-only and you do not know it, run `pnpm auth:password set` to replace it.

## Remote Tunnel

For phone or remote-browser access, expose only the web UI port through your
tunnel provider. With Cloudflare Tunnel quick tunnels:

```bash
cloudflared tunnel --url http://localhost:3050
```

Copy the generated `https://...` URL into `.env` and restart OmniHarness:

```bash
printf 'OMNIHARNESS_PUBLIC_ORIGIN=%s\n' 'https://your-tunnel-url' >> .env
./omniharness
```

Keep OmniHarness password auth enabled even when your tunnel provider also has
its own access controls.

The launcher does not require a global `omniharness` install. Run the app from
the checkout with `./omniharness`, and run CLI conversations from the checkout
with `./omni`.

Preview the agent adapter setup only when you want to install or refresh
optional ACP adapters:

```bash
scripts/install-agent-acp.sh --dry-run
```

Then run the installer directly when you are ready:

```bash
scripts/install-agent-acp.sh
```

The setup script detects supported local coding agents and installs or refreshes
the ACP adapters they need. Codex uses a prebuilt `codex-acp` binary by default
for macOS/Linux on arm64/x64 and Windows x64. Claude's adapter is installed from npm, while
Gemini and OpenCode expose native ACP commands and do not need separate adapter
installs. The setup script also checks common agent tools including `rg`, `git`,
`node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`,
`uv`, `fd`, and `make`.

### Prebuilt Codex ACP

OmniHarness avoids compiling `codex-acp` with host Rust by default. In `auto`
mode, the installer downloads the matching release asset:

```text
codex-acp-darwin-arm64
codex-acp-darwin-x64
codex-acp-linux-arm64
codex-acp-linux-x64
codex-acp-windows-x64.exe
```

Useful overrides:

```bash
OMNIHARNESS_CODEX_ACP_INSTALL=binary
OMNIHARNESS_CODEX_ACP_RELEASE_REPO=danduma/omniharness
OMNIHARNESS_CODEX_ACP_RELEASE_TAG=codex-acp-latest
OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL=https://github.com/danduma/omniharness/releases/download/codex-acp-latest
OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
```

On Windows, use the PowerShell installer to download `codex-acp.exe` into
`%LOCALAPPDATA%\OmniHarness\bin`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-agent-acp.ps1 -AddToPath
```

Git Bash/MSYS users can also run `scripts/install-agent-acp.sh`; it installs
the Windows release asset as `codex-acp.exe`.

For local development against the Rust source, force Cargo mode:

```bash
scripts/install-agent-acp.sh --codex-acp=cargo
```

### Docker-backed Codex ACP

If the prebuilt binary cannot run on a machine, install a Docker-backed wrapper
instead:

```bash
OMNIHARNESS_CODEX_ACP_INSTALL=docker ./omniharness
```

Or run the adapter installer directly:

```bash
scripts/install-agent-acp.sh --codex-acp=docker
```

This builds the local image `omniharness/codex-acp:local`, installs a
`codex-acp` wrapper into `~/.local/bin`, and runs the ACP adapter inside Docker
while mounting the current project and Codex credential/config paths. The normal
OmniHarness worker `PATH` already includes `~/.local/bin`, so no extra PATH
setup is usually needed.

Useful overrides:

```bash
OMNIHARNESS_CODEX_ACP_DOCKER_IMAGE=ghcr.io/your-org/codex-acp:latest
OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
OMNIHARNESS_DOCKER_BIN=podman
OMNIHARNESS_CODEX_ACP_DOCKER_AS_ROOT=1
```

On Podman machines, start the VM first if needed:

```bash
podman machine start
OMNIHARNESS_CODEX_ACP_INSTALL=docker OMNIHARNESS_DOCKER_BIN=podman ./omniharness
```

If you build the image locally instead of using a prebuilt image, give the
Podman VM more than the default 2 GiB memory:

```bash
podman machine stop
podman machine set --memory 8192
podman machine start
```

The container includes Node.js, Codex CLI, `codex-acp`, `git`, `rg`, Python,
`jq`, `make`, and common shell tools. Project commands run inside the Linux
container, so host-only tools still need to be installed in the image or run via
a non-Docker adapter.

## Development

Override runtime settings with environment variables:

```bash
OMNIHARNESS_RUNTIME_DIR=/path/to/omniharness pnpm dev
OMNIHARNESS_BRIDGE_URL=http://127.0.0.1:7801 pnpm dev
```

Run checks before opening a pull request:

```bash
pnpm test
pnpm build
```

## CLI

Run the same ACP-backed conversation modes from the terminal:

```bash
./omni -i -w codex "implement docs/superpowers/plans/example.md"
./omni -p -w gemini "write a plan for the CLI parity work"
./omni -w codex "inspect the current repo state"
```

By default, the CLI starts direct-control conversations, watches the created run, and prints messages, execution events, and worker output updates. Use `-i` for implementation, `-p` for planning, `-w` to choose a worker, `--no-watch` for fire-and-return behavior, or `--json` to print the created conversation payload. The legacy implementation shorthand still works:

```bash
./omni docs/superpowers/plans/example.md
```

Run OmniHarness itself as an ACP agent over stdio:

```bash
./omni acp
```

In ACP mode, clients can create sessions, list persisted Omni runs, load or resume a run, fork a fresh ACP session from an existing run, switch between `implementation`, `planning`, and `direct`, prompt OmniHarness to start or continue conversations, and receive streamed run updates as ACP `session/update` notifications.

## Runtime Data

OmniHarness stores persisted conversation state in SQLite at `sqlite.db` under the app root. The app root is `OMNIHARNESS_ROOT` when set, otherwise the current working directory used to start the app.

For normal local development, inspect runs, messages, workers, execution events, settings, and auth records with:

```bash
sqlite3 sqlite.db
```

`.omniharness/` is used for runtime side files such as the managed runtime lock, but it is not the default conversation database location.

To delete all conversations and associated persisted artifacts:

```bash
scripts/delete-conversations.sh
```

## Agent Tool Environment

ACP workers may be launched from a GUI app, service manager, editor integration, or another non-login process. Those environments often do not inherit the same `PATH` as your normal terminal.

Before spawning agents, the OmniHarness runtime builds a managed worker `PATH` that includes:

- project `node_modules/.bin`
- common user bins such as `~/.cargo/bin`, `~/.local/bin`, `~/.bun/bin`, `~/.opencode/bin`, and pyenv shims
- Homebrew, MacPorts, and system bins
- the inherited environment `PATH`
- login-shell `PATH` when available

This keeps agents from losing essential tools just because the runtime was started from a thin environment. Installing tools globally is still recommended, but the runtime no longer depends only on the parent process `PATH`.

Inspect runtime-side agent health with:

```bash
curl http://127.0.0.1:7800/doctor
```

The doctor response reports adapter availability, API key status, endpoint reachability, and tool diagnostics.

## External Credential Profiles

OmniHarness can apply a generic credential env overlay before spawning any ACP worker. Configure it in Settings -> Agents, set `OMNIHARNESS_CREDENTIAL_PROFILES_DIR` to a directory of profiles, or use the default `.omniharness/credential-profiles` under the OmniHarness root.

Profiles are auto-discovered by worker type, so `.omniharness/credential-profiles/claude` applies to Claude workers. You can also set `OMNIHARNESS_CREDENTIAL_PROFILE_CLAUDE=runner` or pass `credentialProfile` to the runtime API.

File-backed profile:

```text
.omniharness/credential-profiles/claude/
  env/
    ANTHROPIC_BASE_URL
    ANTHROPIC_AUTH_TOKEN
  unset
  expires_at
```

`unset` is one environment variable per line. `expires_at` is optional and only used for status metadata. Secret values are applied to the child process but only key names are exposed in runtime status.

Command-backed profile:

```json
{
  "command": "/Users/you/.local/bin/baton",
  "args": ["credential-profile"],
  "timeoutMs": 5000
}
```

Settings can also point a worker directly at a provider command without a profile folder. For Claude and Baton, set:

```text
OMNIHARNESS_CREDENTIAL_COMMAND_CLAUDE=/Users/you/.local/bin/baton
OMNIHARNESS_CREDENTIAL_COMMAND_ARGS_CLAUDE=["credential-profile"]
```

The command must print JSON:

```json
{
  "env": { "ANTHROPIC_BASE_URL": "https://api.example", "ANTHROPIC_AUTH_TOKEN": "..." },
  "unset": ["ANTHROPIC_API_KEY"],
  "expiresAt": "2026-06-14T04:23:48.000Z"
}
```

## Troubleshooting Setup

- **`This repository is pnpm-only`:** run commands with `pnpm`, not `npm install` or `yarn`.
- **Unsupported pnpm version:** install pnpm 9 or newer, or run `./omniharness` from the repo root so the launcher can use Corepack's known-good default when available.
- **Unsupported Node version:** use Node.js 22.13 or newer, but below Node.js 26. If you already installed dependencies with a different Node version, run `pnpm rebuild better-sqlite3 @node-rs/argon2 sharp`.
- **Native SQLite binding errors:** run `pnpm rebuild better-sqlite3` under your current supported Node version.
- **Windows Corepack `EPERM` under `C:\Program Files\nodejs`:** install pnpm into the user npm prefix with the PowerShell commands in Windows Quick Start, then open a new shell or update `$env:Path` for the current one.
- **Windows install fails with `'cp' is not recognized` while building `@danduma/i18n`:** update to a checkout that pins `@danduma/i18n` to the Windows-compatible commit in `package.json`, then rerun `pnpm install`.
- **`ERR_PNPM_IGNORED_BUILDS` mentions `node-pty`:** current checkouts allow the `node-pty` build in `pnpm-workspace.yaml`. If you are upgrading an older checkout, make sure `allowBuilds.node-pty` is `true`, then rerun `pnpm install`; use `pnpm approve-builds node-pty` only if pnpm still reports the build as pending approval.
- **Windows startup fails with `spawn pnpm ENOENT` or `spawn EINVAL`:** update to a checkout that runs pnpm through the Windows command shell from the start scripts. As a temporary workaround, start the runtime and web server from separate PowerShell windows with `pnpm exec tsx scripts/agent-runtime.ts` and `pnpm exec next start -H 0.0.0.0 -p 3050`.
- **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.
- **Port already in use:** stop the previous OmniHarness process, or set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT` before starting.
- **`http://HOST:3050` times out from another machine:** confirm OmniHarness is listening on `0.0.0.0`, then allow inbound TCP traffic to that port in Windows Firewall and any hosting-provider firewall. Local `http://localhost:3050` can work even when external access is blocked.
- **Phone pairing asks for auth:** set `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH` in `.env` and restart.

## Repository Layout

- `src/app` - Next.js app routes and UI surfaces
- `src/server` - local agent runtime clients, supervisors, persistence, auth, and API support
- `src/lib` - shared client/server utilities and run-state helpers
- `scripts` - development, setup, runtime, and maintenance scripts
- `tests` - Vitest and Playwright coverage
- `docs/superpowers` - design notes, specs, and implementation plans used by the project

## Contributing

Issues and pull requests are welcome. This project is still settling its public contribution process, so keep changes focused and include the checks you ran.

Good first contributions include:

- setup and installation fixes
- clearer docs for supported agents and ACP adapters
- focused bug reports with logs from `/doctor`
- small UI and CLI ergonomics improvements
- tests around conversation recovery, event streaming, and worker lifecycle behavior

Before sending a pull request, run:

```bash
pnpm test
pnpm build
```

## Security

OmniHarness is designed around local-first supervision. The web UI and runtime can start local coding agents that may read and modify files in the projects you point them at. Only run OmniHarness on machines and networks you trust, review agent permissions carefully, and avoid exposing the local runtime directly to the public internet.

## License

OmniHarness is licensed under the GNU Affero General Public License v3.0. See `LICENSE` for the full terms.
