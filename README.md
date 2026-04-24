# OmniHarness

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.6-f69220?logo=pnpm&logoColor=white)](https://pnpm.io/)

OmniHarness is a local-first command center for running serious work through a small crowd of CLI agents. Start a conversation, point it at a project, choose the worker type, and watch the supervisor coordinate planning, implementation, recovery, validation, and live worker output from one polished web UI.

It is built for people who like their automation visible: every run has state, every worker has a pulse, and failures are meant to be inspected instead of politely swept under the rug.

## Why It Exists

AI coding tools are powerful, but long-running work gets messy fast. OmniHarness gives those sessions a home:

- a project-aware conversation inbox,
- a supervisor that can plan, dispatch, retry, and recover work,
- live worker panels for Codex, Claude, Gemini, and OpenCode-style agents,
- persisted run history in SQLite,
- validation and execution events you can audit later,
- encrypted settings for provider keys and runtime preferences,
- optional authentication plus phone pairing for remote check-ins.

In short: less "where did that terminal go?" and more "show me what the team is doing."

## Features

- **Multi-agent cockpit**: launch supervised implementation conversations and follow individual workers from the side panel.
- **Project memory**: keep conversations grouped by repository or workspace.
- **Planning mode**: capture plans, promote them into implementation runs, and preserve artifacts along the way.
- **Live telemetry**: stream messages, worker status, validation results, and execution events through the UI.
- **Recovery paths**: retry failed conversations or unstick workers from the latest checkpoint.
- **Bring your own models**: configure supervisor and fallback LLM providers from the settings dialog.
- **Local persistence**: SQLite-backed runs, messages, settings, sessions, workers, and audit events.
- **Mobile-friendly pairing**: connect a phone session with a short-lived pairing QR when auth is enabled.

## Tech Stack

- **App**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **UI primitives**: Base UI, shadcn-style components, lucide-react icons, xterm
- **State and data**: TanStack Query, Zustand, Drizzle ORM, better-sqlite3
- **Testing**: Vitest, Playwright, ESLint
- **Agent bridge**: ACP bridge at `http://127.0.0.1:7800` by default

## Getting Started

### Prerequisites

- Node.js 20 or newer
- pnpm 9.6.0
- An ACP bridge checkout if you want the dev script to manage local agents automatically

By default, OmniHarness looks for the bridge in a sibling directory:

```bash
../acp-bridge
```

You can point it somewhere else with `OMNIHARNESS_BRIDGE_DIR`, or point at an already-running bridge with `OMNIHARNESS_BRIDGE_URL`.

### Install

```bash
pnpm install
```

### Run The App

```bash
pnpm dev
```

Open [http://localhost:3050](http://localhost:3050).

`pnpm dev` starts the Next.js UI and, when configured, manages the ACP bridge for you. If you want only the web app:

```bash
pnpm dev:web
```

## Useful Commands

```bash
pnpm dev             # Start OmniHarness and the managed bridge flow
pnpm dev:web         # Start only the Next.js web UI
pnpm build           # Build the app
pnpm start           # Serve the production build on port 3050
pnpm lint            # Run ESLint
pnpm test            # Run unit and integration tests
pnpm test:watch      # Run Vitest in watch mode
pnpm test:e2e        # Run Playwright tests
pnpm setup:agents    # Install the agent ACP helper
```

To delete all conversations and their persisted artifacts, use the repo script:

```bash
scripts/delete-conversations.sh
```

## Configuration

Most day-to-day configuration lives in the app settings dialog, including:

- supervisor provider, model, base URL, and API key,
- fallback provider and model,
- default worker type,
- allowed worker types,
- project list,
- worker permission mode.

Secrets are encrypted before they are stored. You can control the settings encryption key with:

```bash
OMNIHARNESS_SETTINGS_KEY
OMNIHARNESS_SETTINGS_KEY_PATH
```

Authentication is optional in development and required outside development unless configured otherwise. To enable it locally:

```bash
OMNIHARNESS_AUTH_PASSWORD="choose-a-good-password"
```

For deployed or shared environments, prefer a password hash and set `OMNIHARNESS_PUBLIC_ORIGIN` so pairing links resolve correctly.

## Project Layout

```text
src/app/home/              Main application shell and orchestration state
src/components/home/       Conversation, sidebar, settings, and worker UI
src/app/api/               HTTP routes for runs, settings, events, auth, and files
src/server/supervisor/     Supervisor runtime and worker dispatch logic
src/server/workers/        Worker snapshots and live status handling
src/server/db/             Drizzle schema and SQLite access
scripts/                   Dev, setup, and maintenance scripts
tests/                     Vitest coverage for API, server, scripts, and UI logic
```

## Contributing

OmniHarness is happiest when changes are visible, testable, and easy to reason about.

Before opening a change:

1. Read `AGENTS.md` for repo-specific workflow rules.
2. Keep work scoped to the behavior you are changing.
3. Add or update tests when behavior changes.
4. Run the smallest useful verification command before you commit.

Good first areas to explore:

- worker status and recovery UX,
- ACP bridge diagnostics,
- test coverage around long-running run states,
- settings import/export,
- documentation and onboarding improvements.

## License

No license file is present yet. Add one before publishing this repository as public open source so contributors know how the project can be used.
