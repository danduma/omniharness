# SQLite `RETURNING` statements can block later commits

## Date

2026-08-16

## Context

OmniHarness creates a run, allocates its first worker number, refreshes the account inventory, appends the first worker-stream entry, and then inserts the user's initial message. These operations share the local libSQL/SQLite client with worker-stream metadata updates.

## Symptom

A live worker-stream cursor update failed with `SQLITE_BUSY: database is locked`. Seconds later, creating another conversation failed while inserting its initial message with `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`. At the same timestamp, account cleanup emitted repeated `cannot commit transaction - SQL statements in progress` errors.

## Root cause

Two write paths used data-changing statements with `RETURNING`:

- worker-number allocation used an upsert with `RETURNING ... .get()`;
- deleted-account cleanup submitted seven `UPDATE`/`DELETE ... RETURNING` statements through `db.batch()`.

With the local libSQL driver, those result-producing write statements could remain active while the transaction tried to commit. That blocked the commit, increased write contention, and allowed conversation creation to reach later persistence steps without a reliably committed parent run.

Separately, worker-stream JSONL bytes were already flushed before the SQLite metadata cursor update. Treating a busy cursor update as an append failure incorrectly surfaced a live-stream error even though the transcript entry was safe on disk.

## Fix

- Worker-number allocation now performs a non-returning upsert and reads the allocated number inside the same retried transaction.
- Deleted-account cleanup uses non-returning batch statements and checks `rowsAffected`.
- A busy artifact cursor update is now deferred after the durable append, emits `artifact.metadata_update_deferred`, and advances the in-process sequence cursor so the next append cannot reuse a sequence number. Non-busy metadata failures still propagate.

## Verification

- Regression tests assert that worker allocation and account-cleanup batches contain no `RETURNING` clause.
- A stream-metadata regression test forces `SQLITE_BUSY`, verifies that the durable append is accepted, verifies the diagnostic event, and verifies that the next reserved sequence advances.
- The relevant account, worker-id, artifact, output-store, event, conversation-route, and type-check suites are run before deployment.

## Prevention

- Do not use DML `RETURNING` in local SQLite transaction or batch paths when a follow-up `SELECT` inside the same transaction can provide the value.
- A durable append and its derived metadata cursor have different failure semantics. The durable bytes are authoritative; a recoverable metadata lock should be observable and retried/caught up, not reported as lost content.
- Tests for append recovery must assert both durability and sequence monotonicity.

## Skill/Doc Updates

This incident reinforces the append-only artifact-stream rules in `docs/architecture/lifecycle-observability-and-testing.md`: JSONL is the durable content authority, SQLite stores its cursor, and metadata failures need typed named events.
