# Session Provider Model

OmniHarness uses `runs` as the durable user-visible session identity. A run now carries `session_type`, with `omni` preserving the existing supervisor/direct/planning behavior and `process` representing local command or script sessions.

The frontend boundary is a provider-neutral `SessionRecord`: `runId`, `sessionType`, `status`, `primaryActorId`, `capabilities`, and safe provider metadata. Components should show actions from capabilities, not from hardcoded assumptions about Omni run modes.

ACP is a backend protocol option, not the UI abstraction. An ACP-backed runtime can become another `SessionProvider`, but the app should continue speaking in provider-neutral session records and actions.

## Persistence

Process sessions add one `process_sessions` row keyed by `run_id` and one normal `workers` row with `type = "process"`. Transcript content still lives in the unified worker stream, written through the generic append-only artifact engine. The on-disk location is project-local when a project is known:

```
<projectPath>/.omniharness/run-data/<runId>/workers/<workerId>.jsonl   (preferred)
<appData>/run-data/<runId>/<workerId>.jsonl                            (legacy, read-only)
```

Do not add another transcript table, sibling JSONL file, or frontend cache for process content. New provider-backed actors append entries through `appendWorkerEntry` via the stream helpers.

## Capabilities

Providers advertise capabilities such as `send_input`, `stop`, `retry_from_message`, `edit_message`, `fork_session`, `queue_input`, and `use_git_workspace`.

Process sessions support `send_input` and `stop` only while running, plus `open_project_file` for the selected project. Terminal process sessions keep `open_project_file` but drop input and stop actions after exit.

## Events

Provider decisions emit named events:

- `session.created`
- `session.starting`
- `session.status`
- `session.input.accepted`
- `session.input.delivered`
- `session.input.refused`
- `session.action.refused`
- `session.stopped`
- `process.spawned`
- `process.exited`

User-relevant failures additionally emit `error.surfaced` with stable codes such as `process.spawn.failed`, `process.stdin.closed`, `process.orphaned_after_restart`, `session.provider.unknown`, and `session.action.unsupported`.

## Process Execution

The process provider uses `spawn(file, args, { shell: false })`. Commands are parsed into argv, cwd is validated inside the selected project scope, environment inheritance is minimal by default, previews redact secret-like arguments, stdout/stderr stream into the worker JSONL, stdin is appended only after delivery succeeds, and stop sends `SIGTERM` before escalating to `SIGKILL`.

On bootstrap, any persisted `starting` or `running` process session without a live handle is marked `orphaned` and surfaced through named events.
