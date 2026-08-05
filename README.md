# OmniHarness

OmniHarness is a local control plane for supervising ACP-backed coding agents.
One logical headless runner owns SQLite, auth, supervision, PTYs, and agent
processes; the shared Vite interface runs in the web/PWA, Electron, iOS,
Android, and VS Code and can stay connected to multiple runners.

Use it when you want one durable place to start coding-agent runs, watch worker output, recover conversations, inspect execution events, and keep local agent processes behind a clear supervisory layer.

## What You Get

- **Multi-agent supervision:** start implementation, planning, and direct-control conversations with supported ACP workers.
- **Live run visibility:** stream messages, worker output, execution events, and status changes while a run is active.
- **Durable local history:** persist runs, messages, workers, settings, auth records, and execution events in SQLite.
- **CLI parity:** launch and watch the same conversation modes from the terminal.
- **ACP server mode:** expose OmniHarness itself as an ACP agent over stdio for compatible clients.
- **Managed agent environment:** spawn workers with a practical `PATH` even when the app starts from a GUI, editor, or service manager.
- **Phone-friendly local UI:** run the web app as a local PWA for supervising work away from the terminal.
- **Multi-runner clients:** save any number of authenticated runners, keep their
  event streams live, and switch the visible workspace without reconnecting.

## Project Status

OmniHarness is early open-source software under active development. Expect sharp edges, fast-moving internals, and occasional database or workflow changes. The core local loop is the priority: reliable worker launch, observable agent activity, durable recovery, and straightforward developer setup.

## Install On macOS

The supported release path is a Mac with `git`, `curl`, and Terminal. Clone the
repository and run the launcher:

```bash
git clone https://github.com/danduma/omniharness.git
cd omniharness
./omniharness
```

That one command installs and starts the server and production UI together. It:

1. selects a supported Node version (`>=22.13 <26`);
2. installs the repository's pnpm version and dependencies;
3. installs the maintained Codex ACP adapter and Codex CLI from published npm
   packages, with no ACP source build;
4. builds the production Vite interface when its inputs change; and
5. starts OmniHarness and opens [http://localhost:3050](http://localhost:3050).

On first start, choose a web login password or press Enter to generate one. A
generated password is printed once; save it before continuing. OmniHarness
stores only its Argon2 hash in `.env`.

Set `OMNIHARNESS_OPEN_BROWSER=0` if you do not want the launcher to open a
browser automatically.

The running deployment contains:

- the API/SSE server and production web interface together on `http://localhost:3050`
- the co-located ACP bridge on `http://127.0.0.1:7800`

There is no separate production UI server to install or expose. The separate
Vite process is only for development.

To update an installation later:

```bash
git pull --ff-only
./omniharness
```

The launcher refreshes its managed published Codex ACP and Codex packages when
new versions are available and rebuilds the UI only when needed. Rolling release
automation separately checks new Codex/model metadata against OmniHarness.

### Requirements and supported agents

- macOS with `git`, `curl`, and a normal Terminal shell. Linux uses the same
  shell launcher but is not release-gated yet.
- `ripgrep` (`rg`) is recommended for fast repository search. The launcher
  installs it when a supported system package manager is available. Set
  `OMNIHARNESS_SKIP_RECOMMENDED_TOOLS=1` to skip that step.
- At least one coding agent for real worker runs:
  - Codex (published ACP adapter and Codex CLI installed by the launcher)
  - Claude CLI plus `claude-agent-acp`
  - Gemini CLI with native ACP mode
  - OpenCode with native ACP mode

Start the runner directly with `pnpm runner`. Use `--no-static` for a supported
API-only deployment, or `--static-dir <path>` for an explicit interface
artifact.

## Clients and deployment

The browser/PWA is served by any runner with `dist/interface`. The other hosts
are remote clients and never embed or start a runner:

```bash
pnpm electron:build
pnpm electron:package:local
pnpm vscode:build
pnpm vscode:package
pnpm mobile:sync
```

Operational and security details:

- [Runner deployment, data roots, proxies, backup, and smoke checks](docs/deployment/runner-operations.md)
- [Authentication, sessions, credential storage, identity, and TLS](docs/security/authentication-and-tls.md)
- [Desktop/editor migration, mobile/PWA limits, and v1 non-goals](docs/platforms/client-migration-and-limits.md)

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

For public access through Cloudflare Tunnel, expose the restart app as a second
hostname only if you intentionally want that public-tunnel deployment:

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

## Private Access With Tailscale

Tailscale Serve is the recommended way to reach OmniHarness from another Mac,
phone, or tablet. It keeps the service inside your tailnet, applies your
Tailscale access rules, and provides a private HTTPS URL. Install the recommended
standalone [Tailscale app for macOS](https://tailscale.com/download/mac), sign in,
and run:

```bash
pnpm setup:tailscale
./omniharness
```

The command verifies the tailnet connection, refuses to overwrite an existing
LAN or tunnel configuration, configures:

```bash
tailscale serve --bg http://127.0.0.1:3050
```

It writes the private `https://...ts.net` origin and loopback bind address to the
ignored local `.env`; the second command restarts OmniHarness with those values.

Check the real private route with `tailscale serve status`, then open the printed
URL from another device on the tailnet. Password authentication remains required;
tailnet membership is an additional security boundary, not a replacement.

Useful safe operations:

```bash
pnpm setup:tailscale -- --dry-run  # inspect without changing Tailscale or .env
pnpm setup:tailscale -- --force    # preserve conflicting values as comments, then replace them
pnpm setup:tailscale -- --reset    # disable OmniHarness HTTPS Serve and remove managed settings
```

`--force` applies only to conflicting OmniHarness values in `.env`. The command
never replaces an unrelated existing Tailscale Serve route; move or remove that
route explicitly first.

If Serve reports an operator, administrator, MagicDNS, or HTTPS-certificate
problem, follow the exact Tailscale error and retry. The setup command leaves
`.env` unchanged when Serve fails.

### Optional Public Access With Cloudflare

Use a public tunnel only when tailnet-only access is not sufficient. Expose port
`3050`, never the ACP bridge on `7800`:

```bash
cloudflared tunnel --url http://localhost:3050
```

Set `OMNIHARNESS_PUBLIC_ORIGIN` in `.env` to the generated HTTPS URL and restart
OmniHarness. Keep OmniHarness password authentication enabled even when the
tunnel provider has separate access controls.

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
the ACP adapters they need. Codex uses the maintained
`@agentclientprotocol/codex-acp` package plus the current `@openai/codex`
package. The Codex package selects its published macOS binary for the current
CPU; the user does not compile an ACP adapter. Claude's adapter is installed from
npm, while Gemini and OpenCode expose native ACP commands and need no separate
adapter. The setup script also checks common agent tools.

### Codex ACP Updates

Normal `./omniharness` startup checks the managed Codex ACP and Codex CLI package
versions and rolls both forward when npm publishes an update. Force an immediate
refresh with:

```bash
scripts/install-agent-acp.sh --codex-acp=npm
```

Useful overrides:

```bash
OMNIHARNESS_CODEX_ACP_INSTALL=npm
OMNIHARNESS_CODEX_ACP_NPM_ROOT=/custom/package/root
OMNIHARNESS_CODEX_ACP_INSTALL_DIR=/custom/bin
```

Cargo mode remains an explicit adapter-development override and is never used by
normal installation:

```bash
scripts/install-agent-acp.sh --codex-acp=cargo
```

### Docker-backed Codex ACP

If you deliberately want ACP isolation, install a Docker-backed wrapper instead:

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

Run the runner and Vite interface together:

```bash
pnpm dev
```

Or run them independently:

```bash
pnpm runner --host 127.0.0.1 --port 3050
pnpm dev:interface
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
- **`ERR_PNPM_IGNORED_BUILDS` mentions `node-pty`:** current checkouts allow the `node-pty` build in `pnpm-workspace.yaml`. If you are upgrading an older checkout, make sure `allowBuilds.node-pty` is `true`, then rerun `pnpm install`; use `pnpm approve-builds node-pty` only if pnpm still reports the build as pending approval.
- **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.
- **Port already in use:** stop the previous OmniHarness process, or set `OMNIHARNESS_RUNNER_PORT` and `OMNIHARNESS_BRIDGE_URL` to unused addresses before starting.
- **The private Tailscale URL times out:** run `tailscale status` and `tailscale serve status`, confirm the client device is in the same tailnet and permitted by its access rules, then restart `./omniharness` after setup.
- **Phone pairing asks for auth:** set `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH` in `.env` and restart.

## Repository Layout

- `src/server` and `src/runtime` - runner, persistence, auth, lifecycle, and HTTP/SSE
- `src/interface`, `src/ui`, and `src/components` - shared React interface
- `src/runtime-api` - transport-neutral runner API and platform adapters
- `src/shared` - pure contracts shared across the runner/interface boundary
- `apps/interface`, `apps/electron`, `apps/mobile`, `apps/vscode` - platform hosts
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
