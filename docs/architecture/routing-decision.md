# Backend Routing Decision

## Status

Open — decision required.

## Context

The repository contains a local instruction (in older AGENTS notes and in the implementation plan's scope notes) stating "do not use file-based routing." However, the current OmniHarness backend is implemented entirely as Next.js route handlers under `src/app/api/**/route.ts`. Examples:

- `src/app/api/auth/session/route.ts`
- `src/app/api/settings/route.ts`
- `src/app/api/agents/catalog/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/fs/route.ts`
- `src/app/api/fs/files/route.ts`
- `src/app/api/run/**/route.ts`
- ...and many more.

This is file-based routing. The instruction and the reality are in direct conflict.

## Options

### Option A — Keep Next route handlers; update the instruction

Acknowledge that the original "no file-based routing" rule is obsolete for this repo. The Next route handlers are:

- Tightly integrated with the dev/build pipeline.
- Tested as a unit alongside the React shell.
- Easy to deploy as a single artifact.
- Already covered by ~125 test files.

Updating the AGENTS / plan instruction to explicitly permit `src/app/api/**/route.ts` removes friction with no functional change.

**Tradeoffs**: locks the backend to Next's routing semantics; harder to extract to a standalone control-plane process later.

### Option B — Migrate to an explicit router outside Next file routes

Stand up an explicit router (e.g. Hono, Fastify, or a small in-process control plane) under `src/server/http/` and mount it from a single `app/api/[[...path]]/route.ts` catch-all (or, eventually, a separate node process).

**Tradeoffs**: a real architectural change. Requires:

- Reimplementing handler discovery and middleware patterns.
- Updating every test that hits route modules.
- A second decision about whether to deploy as a separate process (loses the single-artifact property of Next).

This is out of scope for the current refactor milestone.

## Recommendation

Option A. Update the instruction to permit `src/app/api/**/route.ts` for the backend surface, keep the planned refactor focused on frontend architecture, and revisit Option B only if/when there is a concrete reason to extract the control plane (e.g. running supervisor independently of the web UI).

## Decision

_Pending user confirmation. Once confirmed, update `AGENTS.md` and any plan scope notes that contradict the chosen direction._

No new `src/app/api/**/route.ts` files are being added in this milestone unless required by already-approved current work.
