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

- macOS or Linux with a normal developer shell.
- Node.js 22.x. If you use `nvm`, run `nvm use` from the repo root.
- `pnpm` 9.6.x. The easiest path is `corepack enable`, then let `packageManager` select the pinned pnpm version.
- At least one supported coding agent when you want to run real workers:
  - Codex CLI plus `codex-acp`
  - Claude CLI plus `claude-agent-acp`
  - Gemini CLI with native ACP mode
  - OpenCode with native ACP mode

## Quick Start

Clone the repo, enter it, and select Node 22:

```bash
git clone <repo-url> omniharness
cd omniharness
nvm use
```

Enable Corepack so the repo can use its pinned pnpm version:

```bash
corepack enable
```

Start OmniHarness normally:

```bash
./omniharness
```

Open [http://localhost:3050](http://localhost:3050).

`./omniharness` installs dependencies when needed, builds the production server
when needed, then starts both pieces OmniHarness needs:

- the Next.js web UI on `http://localhost:3050`
- the in-repo agent runtime on `http://127.0.0.1:7800`

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

For the simplest local setup, add a password to `.env`:

```bash
cp .env.example .env
printf 'OMNIHARNESS_AUTH_PASSWORD=%s\n' 'choose-a-long-local-password' >> .env
./omniharness
```

Then open [http://localhost:3050](http://localhost:3050) and log in with that password.

If you do not want the plaintext password in `.env`, store an Argon2 hash instead:

```bash
read -rsp "OmniHarness password: " OMNI_PASSWORD; echo
OMNIHARNESS_AUTH_PASSWORD_HASH="$(
  OMNI_PASSWORD="$OMNI_PASSWORD" node --input-type=module -e '
    import { hash } from "@node-rs/argon2";
    console.log(await hash(process.env.OMNI_PASSWORD, {
      algorithm: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32
    }));
  '
)"
printf 'OMNIHARNESS_AUTH_PASSWORD_HASH=%s\n' "$OMNIHARNESS_AUTH_PASSWORD_HASH" >> .env
unset OMNI_PASSWORD OMNIHARNESS_AUTH_PASSWORD_HASH
./omniharness
```

Use either `OMNIHARNESS_AUTH_PASSWORD` or `OMNIHARNESS_AUTH_PASSWORD_HASH`; the hash wins if both are set. Restart OmniHarness after changing either value.

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

The setup script detects supported local coding agents and installs or refreshes the ACP adapters they need. It also checks common agent tools including `rg`, `git`, `node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`, `uv`, `fd`, and `make`.

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

## Troubleshooting Setup

- **`This repository is pnpm-only`:** run commands with `pnpm`, not `npm install` or `yarn`.
- **Wrong Node major:** run `nvm use`, then retry. If you already installed dependencies with a different Node major, run `pnpm rebuild better-sqlite3`.
- **Native SQLite binding errors:** run `pnpm rebuild better-sqlite3` under Node 22.
- **No supported worker appears:** install or log into at least one supported agent CLI, then run `scripts/install-agent-acp.sh --dry-run` and inspect `curl http://127.0.0.1:7800/doctor`.
- **Port already in use:** stop the previous OmniHarness process, or set `PORT` and `OMNIHARNESS_AGENT_RUNTIME_PORT` before starting.
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

No license file is currently included. Add a `LICENSE` file before treating this repository as broadly reusable open-source software or accepting external contributions.
