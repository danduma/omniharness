# Quota Recovery Must Own Stale Run Status

**Date:** 2026-08-12  
**Context:** OmniHarness direct-control quota reset and reload recovery

## Symptom

A direct run parked for a provider quota reset could lose its recovery dialog after the reset passed while the user was away. On reload, a stale bridge snapshot reported the worker as working, the persisted run became `running` (or remained `failed`), and the durable wake could no longer resume the parked worker.

## Root Cause

Conversation reconciliation and direct-worker status updates trusted a live-looking worker snapshot without checking whether an open quota incident still owned the run. The quota wake path separately treated a stale `failed` run as terminal. These independent writers could therefore erase or refuse an otherwise valid quota recovery.

## Fix

Open/recovering quota incidents now retain ownership across reload reconciliation when the durable run/worker state is parked (`quota_waiting` or `cred-exhausted`). Reconciliation reasserts `quota_waiting`, clears stale failure fields, and emits an observable preservation event. A stale quota-owned `failed` run is recoverable by the elapsed-wait sweep, while a genuinely restarted worker still clears disproven recovery bookkeeping.

## Verification

Added server and lifecycle coverage for stale live snapshots, direct-status writers, stale failed status, lost due wakes, and the complete sleep-through-reset/reload sequence. The focused quota, recovery, and lifecycle suites pass.

## Prevention

For new server-side state writers, treat durable recovery incidents as ownership records and test competing writers in sequence. Include both sides of the transition: stale snapshots must not erase recovery, while genuinely resumed work must resolve recovery that it disproves.

## Skill/Doc Updates

No general skill update was needed; this is recorded as a project-specific control-plane learning.
