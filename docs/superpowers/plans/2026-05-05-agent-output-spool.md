# Agent Output Spool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent agent runtime OOMs by making live status small while preserving complete worker output in a durable, paginated archive.

**Architecture:** The runtime manager should keep only a compact live output window in memory and append all output entries to per-worker JSONL files under `.omniharness/agent-runtime-output/`. `/agents` and `/agents/:name` remain fast status endpoints; `/agents/:name/output` reads archived output by byte cursor.

**Tech Stack:** TypeScript, Node HTTP server, append-only JSONL files, Vitest.

**North Star Product:** OmniHarness can run long, noisy workers for hours while retaining audit-grade output history without making every poll carry the whole transcript.

**Current Milestone:** Replace in-memory output history with a live tail plus disk-backed spool and expose cursor pagination for worker detail/history retrieval.

**Later Milestones / Deferred But Intentional:** Optional SQLite indexing, UI controls for loading older worker output, log rotation/compression, and cross-runtime replay of archived sessions.

**Final Functionality Standard:** This milestone delivers real runtime behavior: status responses are bounded and fast, older output is not silently thrown away, and tests prove archived output can be fetched separately.

---

## File Map

- Create `src/server/agent-runtime/output-store.ts`: output compaction, live-window pruning, JSONL archive creation, append, stats, and cursor reads.
- Modify `src/server/agent-runtime/types.ts`: add output archive metadata and page response types.
- Modify `src/server/agent-runtime/manager.ts`: delegate output ownership to the output store, keep `manager.ts` below the oversized-file threshold, and expose archive reads.
- Modify `src/server/agent-runtime/http.ts`: add `GET /agents/:name/output?cursor=&limit=`.
- Update `tests/server/agent-runtime/http.test.ts`: prove live responses stay bounded, archived output persists, and cursor pagination retrieves older entries.
- `.gitignore` already ignores `/.omniharness/`, covering runtime JSONL output.

## Tasks

- [x] Add failing tests for output archive metadata and cursor retrieval.
- [x] Extract output compaction/spooling into `output-store.ts`.
- [x] Wire runtime manager append paths through the output archive and live window.
- [x] Add the HTTP output page endpoint.
- [x] Verify targeted runtime tests and TypeScript.
