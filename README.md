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

- Node.js 22.x. Run `nvm use` from the repo root to match `.nvmrc`.
- `pnpm`
- At least one supported coding agent:
  - Codex CLI plus `codex-acp`
  - Claude CLI plus `claude-agent-acp`
  - Gemini CLI with native ACP mode
  - OpenCode with native ACP mode

## Quick Start

Install dependencies:

```bash
pnpm install
```

Install or check local ACP adapters and common agent tools:

```bash
pnpm setup:agents
```

Start OmniHarness and the managed agent runtime:

```bash
pnpm dev
```

Open [http://localhost:3050](http://localhost:3050).

To preview what agent setup would do without installing adapters:

```bash
scripts/install-agent-acp.sh --dry-run
```

The setup script checks tools coding agents commonly need, including `rg`, `git`, `node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`, `uv`, `fd`, and `make`.

## Development

`pnpm dev` starts two local processes:

- the Next.js web UI on `http://localhost:3050`
- the in-repo agent runtime on `http://127.0.0.1:7800`

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
pnpm exec tsx omni-cli.ts --mode implementation "implement docs/superpowers/plans/example.md"
pnpm exec tsx omni-cli.ts --mode planning --worker codex "write a plan for the CLI parity work"
pnpm exec tsx omni-cli.ts --mode direct --worker opencode "inspect the current repo state"
```

By default, the CLI watches the created run and prints messages, execution events, and worker output updates. Use `--no-watch` for fire-and-return behavior or `--json` to print the created conversation payload. The legacy shorthand still works:

```bash
pnpm exec tsx omni-cli.ts docs/superpowers/plans/example.md
```

Run OmniHarness itself as an ACP agent over stdio:

```bash
pnpm exec tsx omni-cli.ts acp
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
