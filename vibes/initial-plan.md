# OmniHarness: Supervised Multi-Agent CLI Coding Orchestrator

## Context

User wants a web-based OmniHarness that takes a pre-existing plan file (Superpowers-style) and drives it to **full** implementation by orchestrating multiple headless CLI coding agents (Claude Code, Codex, Gemini, OpenCode) running in parallel. Today, doing this by hand requires:

- Babysitting stuck workers (especially OpenCode) and re-prompting them
- Detecting false "I'm done" claims when checklist items remain unresolved
- Manually approving permission requests
- Juggling 5-hour subscription limits across accounts or falling back to API credits

The cloned repo at `/Users/masterman/NLP/acp-bridge` (v0.3.0, production-grade) already solves the low-level problem: headless ACP multiplexing, parallel task graphs, SSE output streaming, session modes, permission control — all behind a clean HTTP REST API on `:7800`. **Answer to the framing question: yes, it is an excellent starting point — it is essentially the backend for this project.** This plan builds the missing layer on top: an LLM-powered supervisor plus a web interface.

### Why not `cli-agent-orchestrator` (CAO) as the backend

Also evaluated: `/Users/masterman/NLP/cli-agent-orchestrator` (AWS Labs, Python, v2.0.0, actively maintained). More "finished" as a product — ships a React+xterm.js dashboard, SQLite persistence, and 7 provider adapters (Kiro, Claude Code, Codex, Gemini, Kimi, Q, Copilot) — but architecturally conflicts with this design:

- **Supervision is agent-driven, not LLM-as-judge.** CAO's supervisor is another agent with a role profile calling MCP tools (`handoff`/`assign`/`send_message`). Judgment lives inside that agent's prompt and cannot be tuned/swapped independently.
- **No task DAGs.** CAO uses cron-based `Flow`s, not dependency graphs. Superpowers plan files don't map naturally.
- **tmux + regex screen-scraping.** Fragile to ANSI/TUI edge cases; less reliable for stuck/false-complete detection than ACP's structured JSON-RPC.
- **Credit handling: neither has it.** Same gap as acp-bridge.

**Decision**: keep acp-bridge as the backend. **Borrow patterns from CAO** where useful (see "Patterns borrowed from CAO" below).

## Goal

Ship **OmniHarness v1**: a locally-hosted web app that, given a path to a pre-existing plan file, autonomously executes it to completion using a pool of CLI coding agents — detecting stuck workers, re-prompting them, auto-handling routine confirmations, escalating ambiguity to the user via chat, and gracefully swapping credit sources when subscription limits hit.

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                        Web UI                          │
│  chat panel │ workers │ plan progress │ accounts/creds │
└──────────────┬─────────────────────────────────────────┘
               │ (HTTP + SSE)
┌──────────────▼─────────────────────────────────────────┐
│                  OmniHarness Backend                  │
│  ┌─────────────────┐   ┌────────────────────────────┐ │
│  │ Supervisor Loop │───│  Supervisor Tool Registry  │ │
│  │  (token.js LLM  │   │  plan_*, worker_*,         │ │
│  │   loop w/ prompt│   │  credits_*, user_ask       │ │
│  │   + memory)     │   └────────────┬───────────────┘ │
│  └────────┬────────┘                │                 │
│  ┌────────▼────────┐                │                 │
│  │ State Store     │                │                 │
│  │ (SQLite/Drizzle)│                │                 │
│  └─────────────────┘                │                 │
└─────────────────────────────────────┼─────────────────┘
                                      │ HTTP :7800
┌─────────────────────────────────────▼─────────────────┐
│              acp-bridge daemon (EXISTING)             │
│   workers: Claude Code │ Codex │ Gemini │ OpenCode    │
└───────────────────────────────────────────────────────┘
```

## Components

### 1. Supervisor engine (new)

- Tool-calling LLM loop, provider-agnostic via **token.js** (configurable per install)
- Persistent per-plan memory: progress notes, decisions, stuck-recovery history — survives restarts
- System prompt teaches workflow: **load plan → decompose → delegate → watch → unstick → verify → repeat**
- **Extension point**: a future variant may run the supervisor *inside another harness* (e.g., another Claude Code / Codex instance as "the overseer") with the same tool surface exposed as ACP tools. MVP keeps it as a custom token.js loop for tighter control; the tool registry is designed to be reusable under either runtime.

Supervisor tool surface:

| Category | Tool | Purpose |
|---|---|---|
| Plan | `plan_read(path)` | Load plan file |
| Plan | `plan_checklist_update(item, status)` | Track completion |
| Plan | `plan_mark_done(reason)` | Terminal state |
| Worker | `worker_spawn(type, cwd, mode, account?)` | Spawn via acp-bridge |
| Worker | `worker_send_prompt(id, prompt)` | Push message |
| Worker | `worker_read_output(id, since)` | Fetch buffered output |
| Worker | `worker_approve(id, reqId)` / `worker_deny(...)` | Permission flow |
| Worker | `worker_set_mode(id, mode)` | full-access / auto / read-only |
| Worker | `worker_cancel(id)` | Abort |
| Credits | `credits_check(accountId)` | Remaining budget/reset time |
| Credits | `credits_switch(workerId, strategy)` | Apply exhaustion strategy |
| Credits | `wait_for_reset(accountId)` | Park until reset |
| UX | `user_ask(question)` | Escalate to chat panel |

### 2. Worker agents (leveraged as-is)

- Unchanged use of acp-bridge — **zero modifications** for MVP
- Parallel execution via acp-bridge task graphs (`POST /tasks`)
- Session modes, streaming, permission flow: all existing

### 3. Web frontend (new)

- **Chat panel (primary)** — conversation with supervisor; user types `implement <path>`, follow-ups, overrides; supervisor narrates decisions and escalates ambiguity
- **Workers panel** — live list with state chip (`idle` / `working` / `stuck` / `cred-exhausted`), current prompt, streaming output preview, expand-to-detail. **Expanded view renders an xterm.js terminal** (CAO-borrowed pattern) showing the worker's SSE output stream as a live terminal, with ANSI colour preserved
- **Plan panel** — loaded plan rendered with checkbox progress synced from `plan_checklist_update` calls
- **Accounts/Credits panel** — configured accounts per provider, remaining quota, reset times, currently-assigned workers

### 4. Multi-account / credit manager (new)

Config (YAML) declares accounts: `{ id, provider, type: subscription|api, auth_ref, capacity, reset_schedule }`. Per-account usage is persisted. Strategies (priority-ordered per agent type):

- `swap_account` — migrate worker to another same-provider subscription (re-spawn under different env/profile)
- `fallback_api` — switch worker's provider config from subscription to direct API
- `wait_for_reset` — pause, schedule resume at reset time
- `cross_provider` — failover to a different agent type (when the current step tolerates it)

Detection: parse acp-bridge agent stderr / response error classification (already exposed by its `doctor`/diagnose pipeline — 401/403/429/quota signatures).

### 5. State persistence (new)

- SQLite + Drizzle ORM
- Tables: `plans`, `runs`, `messages` (user ↔ supervisor, supervisor ↔ worker), `workers`, `accounts`, `credit_events`
- Mid-flight plan runs resume after restart

## Tech stack

- **Framework**: Next.js 15 (App Router, TypeScript) — single repo with frontend + backend API routes + SSE via route handlers
- **LLM abstraction**: **token.js** (native TS, broad provider coverage). Fallback: litellm via HTTP sidecar if token.js has gaps for a needed provider.
- **DB**: SQLite + Drizzle
- **UI**: Tailwind + shadcn/ui; Zustand (client state); TanStack Query (server state); **xterm.js** for per-worker terminal-emulator views (pattern lifted from CAO's dashboard)
- **Process model**: the web app talks to `acp-bridge` only over HTTP — never spawns subprocesses itself

## Repository layout

Sibling of acp-bridge, new project:

```
/Users/masterman/NLP/
├── acp-bridge/        (existing — leveraged)
└── OmniHarness/      (NEW)
    ├── app/           (Next.js UI)
    ├── server/
    │   ├── supervisor/        (loop, tools, prompt, memory)
    │   ├── bridge-client/     (typed HTTP client for acp-bridge REST API)
    │   ├── credits/           (account mgr, strategies, detection)
    │   └── db/                (Drizzle schema + migrations)
    ├── config/                (accounts.yml, supervisor.yml)
    └── drizzle/
```

## Implementation phases

Each phase leaves a usable system.

**Phase 1 — Skeleton + single-worker loop**
- Next.js scaffold, SQLite schema, typed acp-bridge HTTP client
- Supervisor loop via token.js with minimal tool set: `plan_read`, `worker_spawn`, `worker_send_prompt`, `worker_read_output`, `plan_mark_done`, `user_ask`
- Chat panel only; single sequential worker; no parallelism; no credit handling
- E2E: a 3-item Markdown plan runs start-to-finish with a Claude Code worker

**Phase 2 — Parallel workers + stuck detection**
- Use acp-bridge task graphs for parallel subtasks
- Stuck/false-complete detection: heuristics (output-silence timeout, repeated output, "done" claim with unresolved checklist items) + LLM judgment fallback
- Workers panel in UI with live streaming previews

**Phase 3 — Permission auto-handling + escalation**
- Classify permission requests (routine file-write vs. shell exec vs. network) via config rules + LLM
- Auto-approve routine; escalate sensitive via `user_ask`

**Phase 4 — Credit management**
- Account config + usage tracking
- Exhaustion detection from acp-bridge error signatures
- Four strategies wired with configurable priority order

**Phase 5 — Multi-plan + polish**
- Concurrent plan runs
- Plan panel progress rendering; accounts dashboard

## Patterns borrowed from CAO (reference only — no code dependency)

- **xterm.js terminal view per worker**: CAO's React dashboard exposes live PTYs via xterm.js over WebSocket. We adopt the same UX pattern for the Workers panel, but fed by acp-bridge's SSE stream instead of a raw PTY.
- **SQLite schema shape**: CAO's `terminals` + `inbox_messages` tables are a useful reference for our `workers` + `messages` tables (status enums, async message-queue semantics).
- **Future extension — non-ACP provider adapters**: if we later need Kiro / Q CLI / Copilot CLI / Kimi support (which don't speak ACP), we can vendor CAO's tmux-based provider adapters behind the same supervisor tool surface. Out of scope for v1.

Reference paths (read-only):
- `/Users/masterman/NLP/cli-agent-orchestrator/webui/` — dashboard source for xterm.js patterns
- `/Users/masterman/NLP/cli-agent-orchestrator/` — SQLite models for terminals/inbox

## Files / components to reuse

- `/Users/masterman/NLP/acp-bridge/src/daemon.ts` — HTTP API contract; read to derive typed client
- `/Users/masterman/NLP/acp-bridge/src/cli.ts` — reference for payload shapes and error handling
- SSE: `GET /agents/:name/ask?stream=true` — supervisor's `worker_read_output` consumes this
- Task graph: `POST /tasks` — supervisor drives parallel subtasks here in Phase 2
- Permission flow: `POST /agents/:name/approve|deny` — supervisor wraps as `worker_approve`/`worker_deny`
- Doctor/diagnose: reused for account health checks

## Verification

- **Phase 1**: toy 3-item Superpowers plan (one file edit each). Start harness → type `implement <path>` in chat → observe single worker drive to completion; DB `runs` row transitions to `done`.
- **Phase 2**: 3-item plan with no inter-deps → observe 3 parallel workers in UI. Force-kill one mid-task → supervisor detects stall, re-prompts or re-spawns, plan still completes.
- **Phase 3**: plan requiring `npm install` → supervisor escalates shell-exec to chat, user approves, work continues.
- **Phase 4**: stub acp-bridge responses with quota-exhaustion errors → exercise each strategy (swap_account, fallback_api, wait_for_reset) and verify state transitions + resumed work.
- **Phase 5**: two plans submitted back-to-back → independent progress rendered; no cross-contamination of worker pools.

## Open decisions (confirm before Phase 1 starts)

1. **Tech stack**: Next.js + Tailwind + shadcn chosen for ecosystem + fullstack simplicity. OK? (Alternatives: SvelteKit; Vite+Fastify+React.)
2. **LLM abstraction**: token.js first, litellm sidecar as fallback. OK?
3. **Plan format**: inherit the Superpowers plan convention (markdown, `## Phase N` sections, `- [ ]` checkboxes). Will need to confirm exact schema by reading the superpowers skill once implementation begins.
4. **Supervisor runtime**: custom token.js loop for MVP; "supervisor-as-another-harness" deferred to v2 with the same tool registry exposed as ACP tools. OK?
5. **CLI vs web**: web UI only for v1. A `OmniHarness` CLI client can be added later for scripting.
6. **Repository location**: sibling to acp-bridge at `/Users/masterman/NLP/OmniHarness/`. OK?
