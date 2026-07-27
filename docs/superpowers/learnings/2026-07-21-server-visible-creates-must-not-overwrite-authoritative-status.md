# Server-visible creates must not overwrite authoritative status

## Context

The home Manager keeps an optimistic conversation record while the create request is in flight. A selected-run snapshot can legitimately omit another run's message records while still carrying that run's authoritative status.

## Symptom

A completed background conversation briefly returned to `running` after switching sessions. Its sidebar spinner and Stop button reappeared even though the server and worker were already done.

## Root cause

Once the optimistic create had become visible on the server, the client still merged the entire stale create snapshot back over later server state. The missing message record was real partial-snapshot behavior, but it was incorrectly treated as permission to restore the stale run status too.

## Fix

After a pending create is known to be server-visible, preserve only records that the incoming snapshot is allowed to omit, such as scoped message or plan records. Never use that stale create response to overwrite an incoming authoritative run or worker record.

## Verification and prevention

A home-state regression now proves that an omitted message can be retained without restoring a stale `running` status. Every optimistic merge must define authority separately for each record type; partial scope is not blanket permission to replay an older snapshot.
