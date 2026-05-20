# Hot-Path Responsiveness and Resource Leaks

> Incident notes and permanent rules from the May 2026 worker-streaming latency
> failure. The lesson is blunt: the app must serve the page and control-plane
> hot paths even while workers, supervisors, bridge polling, and persistence are
> busy.

## Why This Exists

On May 20, 2026 the local app repeatedly became unresponsive while a supervisor
process was managing a long-running worker. Chrome showed hard reloads stuck in
`pending`, and server logs showed request times that are unacceptable for a
control plane:

```text
GET /api/events?runId=ca18b7e86437 200 in 55543ms
GET /api/events?snapshot=1&persisted=1&runId=70a589b48ba5... 200 in 103695ms
GET /api/workers/70a589b48ba5-worker-2/entries?afterSeq=0 200 in 80421ms
```

Later live evidence was worse:

```text
GET /api/events?runId=ca18b7e86437 200 in 487273ms
GET / 200 in 325220ms
GET /api/workers/ca18b7e86437-worker-3/entries?afterSeq=250 401 in 62700ms
```

Another reload failure exposed the same class of bug through optional catalog
work:

```text
GET /api/agents/catalog 200 in 65581ms
GET /api/agents/catalog 200 in 122868ms
GET / 200 in 130440ms
GET /session/8ad0c5c3f219 200 in 130473ms
```

This was not a cosmetic frontend problem. The server was failing the basic
product promise: serve the page, show current state, and keep worker streams
usable while work is running.

## Symptoms We Observed

- Hard reloads and normal reloads could sit in Chrome's Network tab as
  `pending` instead of returning the HTML shell.
- Worker stream polling became slower as workers produced more transcript
  content.
- `/api/events` snapshots took tens of seconds to minutes.
- `/api/agents/catalog` could spend more than a minute on worker/model
  discovery while the user was only trying to load an existing conversation.
- The Next dev process repeatedly printed `[db] schema ready`, which was a sign
  that request/module evaluation was reopening DB-backed modules.
- A contaminated long-running dev process held dozens of sqlite-related file
  descriptors. In the live incident, the old Next process held 34 sqlite FDs.
- The app appeared worse with supervisor-driven worker turns because the
  supervisor increased worker-history reads, bridge polling, event snapshots,
  and worker stream traffic.

## Root Causes

### 1. Snapshots Included Worker Transcript Bodies

Persisted event bootstrap and snapshot payloads loaded worker entries directly
from disk and included them in `workerEntries`. That meant a page reload or
`/api/events?snapshot=1&persisted=1` could walk large worker transcripts before
responding.

Snapshots need cursors, not transcript bodies. The worker stream endpoint is
the content authority.

### 2. Worker Stream Reads Were Full-File Reads

`GET /api/workers/:workerId/entries?afterSeq=N` could fall back to reading and
parsing the whole JSONL transcript even when the client only needed entries
after a recent cursor. As a worker transcript grew, every poll became more
expensive.

Incremental reads must use the JSONL tail for `afterSeq > 0` and only fall
back to canonical full reads for legacy, compressed, corrupt, or first-load
cases.

### 3. Worker Stream Writes Rebuilt Caches On Every Append

The writer assigned seqs and deduplicated bridge entries by rebuilding the
seen-id/fingerprint state from the full JSONL file on each append. Streaming
assistant text made this especially bad: each new chunk paid the cost of all
previous chunks.

The normal append path must be O(new entries), not O(transcript history). The
writer cache is allowed to rebuild from disk on first use after process start
or when file stats prove another writer touched the file.

### 4. Hot Routes Imported DB-Backed Modules Too Early

Some unauthenticated or no-cookie paths imported modules that immediately
created DB clients and initialized schema, even though the request could have
returned without touching sqlite. This happened on routes like worker entries
and auth/session bootstrap.

Hot-path imports are part of runtime behavior. A top-level import of a DB
module is a DB dependency for every request that loads that route module.

### 5. DB Client State Was Not Stable Across Module Re-Evaluation

Next dev and runtime module re-evaluation can reload server modules. A DB client
created as a plain module singleton is not necessarily a process singleton in
that environment. Repeated evaluation created more sqlite clients and handles.

Resource singletons in the dev server must be process-scoped and keyed by the
actual resource path.

### 6. Page SSR Blocked On Too Much Application State

The root page SSR path built a rich bootstrap payload that could include auth
state, settings, and event snapshots. That made "serve HTML" depend on the same
slow paths as "hydrate full app state".

The page must return a shell quickly. Runtime bootstrap, settings, event
snapshots, and worker transcripts are client/runtime follow-up requests.

### 7. Root Client Bundle Compilation Could Block HTML In Dev

Even after server bootstrap was narrowed, the root page imported the entire
`HomeApp` client graph up front. In Next dev, compiling that graph could block
the first HTML response for the page, especially while the server was already
under load.

The shell must be small. Heavy app graphs can load behind a dynamic client
boundary with an immediate boot shell.

### 8. Catalog Discovery Was Treated As Load-Bearing State

The frontend eagerly requested `/api/agents/catalog` during app bootstrap and
conversation reloads, even though catalog data is optional metadata for
onboarding, settings, and explicit refresh. The route could also perform
blocking local CLI availability probes. When a CLI probe or login shell stalled,
conversation load stalled behind work that was unrelated to rendering the
selected transcript.

Catalog discovery must be demand-driven and bounded. Existing conversations can
render from persisted run/worker metadata and cached/static worker definitions;
they must not wait for fresh worker availability, model discovery, or CLI health
checks.

## Fixes That Addressed The Incident

- Persisted snapshots now publish `workerEntrySeqs` instead of `workerEntries`.
- Snapshot builders use `readWorkerLatestSeq()` rather than
  `readWorkerEntriesSince(..., 0)` for worker cursor hints.
- Worker entry reads use a bounded JSONL tail reader for incremental cursors.
- Worker entry writes keep next-seq, seen ids, fingerprints, and file state in
  a per-worker cache and only rebuild when file stats change.
- API auth checks return missing-auth responses before dynamically importing
  DB-backed session code.
- API session caching is TTL-bounded and size-bounded.
- `buildAuthSessionState()` returns unauthenticated no-cookie state before
  importing DB-backed session code.
- DB state is cached on `process` in a path-keyed map so repeated module
  evaluation reuses the same sqlite client for the same DB path.
- Home SSR calls `buildRuntimeBootstrap({ includeInitialData: false })`.
- The root `OmniApp` dynamically imports the heavy `HomeApp` client graph and
  renders `BootShell` while it loads.
- The home bootstrap path no longer fetches `/api/agents/catalog` on page load,
  app unlock, focus, or conversation selection.
- Catalog requests are reserved for onboarding, Agents settings, and explicit
  manual refresh. Conversation rendering uses persisted run/worker data and
  cached/static catalog fallbacks.
- The catalog API avoids blocking local CLI probes in the frontend request path
  and returns degraded-but-useful data when live availability is slow.

## Verification Evidence From The Fix

Automated verification:

- Focused hot-path suite:
  `tests/api/auth-guard-cache.test.ts`,
  `tests/api/worker-entries-hot-path.test.ts`,
  `tests/ui/ssr-bootstrap.test.ts`,
  `tests/api/conversation-load-coverage.test.ts`,
  `tests/api/events-route.test.ts`,
  `tests/api/runtime-bootstrap-route.test.ts`, and
  `tests/server/workers/output-store.test.ts`.
- Lifecycle suite: `pnpm test:lifecycle`.
- ESLint over touched hot-path files.

Live clean-process validation after the fixes:

```text
Next ready: 3.7s
Initial / prewarm: 9775ms
Initial persisted event snapshot prewarm: 5514ms
Initial worker entries after route compile: 410-445ms
Steady /: 329-490ms
Steady /api/auth/session: 398-548ms
Steady worker entries auth miss: 416-597ms
sqlite FDs: stable at 4
```

The old contaminated process had 34 sqlite-related FDs and request times in the
tens of seconds to minutes. The clean process after the fix stayed at 4 sqlite
FDs and returned steady hot-path requests in under a second.

## Permanent Rules

### Rule 1: The Page Shell Must Be Cheap

The root page may parse route params and produce a minimal shell bootstrap. It
must not synchronously load:

- persisted event snapshots,
- full settings state,
- worker transcripts,
- bridge catalogs,
- supervisor/recovery reconciliation,
- project memory,
- external health probes.

If a future feature needs those, load them through runtime APIs after the shell
has been served.

### Rule 2: Snapshots Carry Cursors, Not Large Bodies

Event snapshots can include compact metadata and cursor hints. They must not
inline append-only content such as worker transcript bodies. For workers, the
snapshot contract is `workerEntrySeqs`; content comes from
`GET /api/workers/:workerId/entries?afterSeq=N`.

### Rule 3: Hot Reads Must Be Bounded

For any endpoint that is called during boot, reload, reconnect, polling, or
stream wake-up:

- read from a bounded cursor, tail, cache, or compact read model;
- set short timeouts around external dependencies;
- return degraded but useful responses when optional state is unavailable;
- never wait on bridge health checks or reconciliation writes.

A 25 second hot-path request is a control-plane failure even if it eventually
returns 200.

### Rule 4: Streaming Appends Must Not Reprocess History

Worker stream append cost must scale with the new entries being appended, not
with all historical entries in the transcript. Full transcript scans are only
allowed for:

- first cache seed after process start,
- detected external file mutation,
- compaction/expansion/repair,
- explicit maintenance scripts.

Normal bridge polling and streaming token updates must not parse the whole
worker file.

### Rule 5: Top-Level Imports Count As Hot-Path Work

If a route can return before touching the DB, bridge, file system, or a heavy
module graph, its top-level imports must preserve that property. Use dynamic
imports after cheap gates such as method checks, auth cookie presence, and
parameter validation.

This is especially important for:

- auth guards,
- session bootstrap,
- worker entries,
- event snapshots,
- settings and catalog routes.

### Rule 6: Resource Singletons Must Be Process-Scoped And Keyed

Local dev can re-evaluate modules. Do not assume a module-level `const client`
is enough for scarce resources. DB clients, lock managers, and other process
resources should be cached on `process` or another true process-level owner and
keyed by the path/URL they represent.

For sqlite, watch FD counts during live validation. A healthy dev web process
should not accumulate new sqlite FDs as routes are requested.

### Rule 7: Caches Must Be Bounded

Every process-local cache introduced to protect a hot path needs an explicit
bound:

- TTL, size, or both;
- key space with known cardinality;
- invalidation behavior for writes or external mutation;
- test coverage for eviction or no-growth behavior.

Do not trade a DB leak for an unbounded memory cache.

### Rule 8: Dev Prewarm Must Not Mask Broken Hot Paths

Prewarm can make the first interactive page nicer, but it is not a correctness
fix. If prewarm takes tens of seconds or blocks other requests, that is still a
bug. Use prewarm logs as performance evidence, not as a place to hide slow
routes.

### Rule 9: Catalogs Are Demand-Driven Metadata

Worker catalogs, model catalogs, provider availability, CLI health, and project
file indexes are not conversation-load prerequisites. They may support chooser
menus, onboarding, diagnostics, and settings pages, but the selected
conversation must render without waiting for them.

Default cadence:

- do not fetch `/api/agents/catalog` during root page bootstrap, route
  selection, app unlock, or focus restore;
- fetch catalog data when the user opens onboarding or Agents settings, or when
  the user explicitly refreshes runtime availability;
- use cached or static definitions while a fresh catalog refresh is pending;
- put short timeouts around live probes and return partial results instead of
  serializing the request queue behind a hung local CLI;
- keep project file indexing behind file mention/search intent, not general app
  load.

### Rule 10: Test The Failure Shape Directly

Every future change touching boot, snapshots, auth guards, worker streams, or
resource ownership should include at least one targeted assertion from this
list:

- unauthenticated hot path returns before importing DB-backed modules;
- snapshot payload does not contain worker transcript bodies;
- worker append cache does not rebuild from disk on every streaming append;
- incremental worker reads are served from the JSONL tail;
- DB clients are process/path scoped;
- page bootstrap calls `includeInitialData: false`;
- root page does not synchronously import the heavy app graph;
- conversation load and home bootstrap do not eagerly request
  `/api/agents/catalog` or project file indexes.

## Review Checklist For Future PRs

Use this checklist before merging any change near the control plane:

- Does this route run on page load, reload, reconnect, SSE wake-up, polling, or
  worker streaming cadence?
- What are its top-level imports, and do any of them open DB handles, start
  schema initialization, read large files, or probe the bridge?
- Is this request optional metadata such as catalog, model, availability, or
  file-index data? If so, why is it on the current hot path?
- Is the worst-case read bounded by a cursor, tail window, limit, or cache?
- Can it return a degraded response if optional state is slow?
- Does it include append-only bodies in a broad snapshot?
- Does it create a process-local cache, and is that cache bounded?
- Does it create a scarce resource, and is that resource owned by a stable
  process-level singleton?
- What command proves it does not regress?
- What live metric should stay flat: sqlite FDs, RSS, response time, or all
  three?

## Commands We Used To Diagnose

Run lookup:

```bash
sqlite3 sqlite.db "select id,status,mode,title,updated_at from runs where id = '<runId>';"
sqlite3 sqlite.db "select id,run_id,type,status,bridge_session_id,worker_number,updated_at from workers where run_id = '<runId>' order by updated_at desc;"
sqlite3 sqlite.db "select event_type,worker_id,created_at,substr(details,1,200) from execution_events where run_id = '<runId>' order by created_at desc limit 20;"
```

Process and sqlite FD checks:

```bash
ps -axo pid,ppid,rss,pcpu,etime,command | rg 'next-server|scripts/dev|remote-restart' | rg -v rg
PID=$(lsof -tiTCP:3050 -sTCP:LISTEN | head -n1)
ps -o pid=,rss=,pcpu=,etime=,command= -p "$PID"
lsof -p "$PID" 2>/dev/null | rg 'sqlite.db($|-wal|-shm)' | wc -l
```

Bounded live request checks:

```bash
curl --max-time 10 -sS -o /tmp/omni-root.out -w 'root status=%{http_code} time=%{time_total}\n' http://127.0.0.1:3035/
curl --max-time 10 -sS -o /tmp/omni-auth.out -w 'auth status=%{http_code} time=%{time_total}\n' http://127.0.0.1:3035/api/auth/session
curl --max-time 10 -sS -o /tmp/omni-worker.out -w 'worker status=%{http_code} time=%{time_total}\n' 'http://127.0.0.1:3035/api/workers/<workerId>/entries?afterSeq=0'
```

Use bounded checks. Do not run unbounded stress loops on a machine already
showing memory pressure or UI instability.

## Tests That Guard This Class

- `tests/ui/ssr-bootstrap.test.ts` checks that the page bootstrap avoids
  persisted snapshots, that worker/auth hot paths avoid eager DB imports, and
  that the heavy `HomeApp` graph is dynamically loaded.
- `tests/api/worker-entries-hot-path.test.ts` checks that the common
  run-id-derived worker entries route can serve without importing DB/schema and
  that missing auth returns before DB-backed work.
- `tests/api/auth-guard-cache.test.ts` checks that API session validation is
  reused and bounded.
- `tests/server/workers/output-store.test.ts` checks tail reads, latest-seq
  reads, write cache behavior, external file mutation refresh, append/compaction
  ordering, and crash-truncated lines.
- `tests/api/events-route.test.ts` checks snapshot shape and event behavior.
- `tests/app/home-queries-catalog.test.ts` checks that home bootstrap does not
  eagerly fetch catalog or project file data and only does so for explicit
  user-facing catalog/file workflows.
- `pnpm test:lifecycle` checks reconnect, restart, failover, recovery, delete,
  and process-session behavior over HTTP/SSE.

## Anti-Patterns To Refuse

- "Just include the entries in the snapshot so the frontend has everything."
- "This route only imports the DB; it does not query until later."
- "The full JSONL read is fine because files are small right now."
- "Prewarm will hide the slow first request."
- "A process-local cache is small enough without a limit."
- "Dev-only slowness is acceptable for the control plane."
- "The worker is running, so a reload can wait."
- "We need fresh worker availability before showing an existing conversation."
- "Fetching the catalog on focus is harmless because the response is cached."

The worker may be running for hours. The page still has to serve.
