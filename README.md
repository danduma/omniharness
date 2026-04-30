# OmniHarness

OmniHarness is a local web UI for supervising ACP-backed coding agents such as Codex, Claude, Gemini, and OpenCode. It starts a Next.js app and an in-repo agent runtime that owns the actual agent processes.

## Requirements

- Node.js 20+
- `pnpm`
- At least one supported coding agent installed:
  - Codex CLI plus `codex-acp`
  - Claude CLI plus `claude-agent-acp`
  - Gemini CLI with native ACP mode
  - OpenCode with native ACP mode

## Setup

Install app dependencies:

```bash
pnpm install
```

Install or check local ACP adapters and common agent tools:

```bash
pnpm setup:agents
```

Preview what setup would do without installing adapters:

```bash
scripts/install-agent-acp.sh --dry-run
```

The setup script checks common tools that coding agents expect to use, including `rg`, `git`, `node`, shell/file utilities, package managers, Python, `jq`, `gh`, `cargo`, `uv`, `fd`, and `make`.

## Development

Start OmniHarness and the managed agent runtime:

```bash
pnpm dev
```

Open [http://localhost:3050](http://localhost:3050).

By default, `pnpm dev` starts the in-repo runtime on `http://127.0.0.1:7800`. Override with:

```bash
OMNIHARNESS_RUNTIME_DIR=/path/to/omniharness pnpm dev
OMNIHARNESS_BRIDGE_URL=http://127.0.0.1:7801 pnpm dev
```

## Runtime Data

OmniHarness stores persisted conversation state in SQLite at `sqlite.db` under the app root. The app root is `OMNIHARNESS_ROOT` when set, otherwise the current working directory used to start the app.

For this repository in normal local development, inspect runs, messages, workers, execution events, settings, and auth records in:

```bash
sqlite3 sqlite.db
```

`.omniharness/` is used for local runtime side files such as the managed runtime lock, but it is not the default conversation database location.

## Agent Tool Environment

ACP workers may be launched from a GUI app, service manager, editor integration, or other non-login process. Those environments often do not inherit the same `PATH` as your normal terminal.

The OmniHarness agent runtime builds a managed worker `PATH` before spawning agents. It includes:

- project `node_modules/.bin`
- common user bins such as `~/.cargo/bin`, `~/.local/bin`, `~/.bun/bin`, `~/.opencode/bin`, and pyenv shims
- Homebrew, MacPorts, and system bins
- the inherited environment `PATH`
- login-shell `PATH` when available

This keeps agents from losing essential functionality just because the runtime was started from a thin environment. Installing tools globally is still recommended, but the runtime no longer depends only on the parent process `PATH`.

To inspect runtime-side agent health:

```bash
curl http://127.0.0.1:7800/doctor
```

The doctor response reports adapter availability, API key status, endpoint reachability, and tool diagnostics.

## Useful Scripts

Run tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
```

Delete all conversations and associated persisted artifacts:

```bash
scripts/delete-conversations.sh
```
