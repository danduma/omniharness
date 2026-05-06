# Project-Wide Supervisor Memory Design

## Summary

Give the OmniHarness supervisor durable project-wide memory stored inside the project repository at:

```text
.omniharness/memory/
```

This memory is file-based and human-readable. It belongs to the project, not to an individual conversation, run, worker, or OmniHarness app-data directory. The supervisor can list, read, write, and append memory files through simple tools. Those tools should use normal filesystem operations under strict path boundaries, while `execution_events` remain the audit trail for what the supervisor read or changed.

## Goals

- Store all project-relevant supervisor memory under the project-local `.omniharness` directory.
- Use files as the source of truth for memory.
- Keep the memory format inspectable and editable by humans and workers.
- Give the supervisor small, explicit memory tools instead of relying on ad hoc repository reads and writes.
- Make memory available across conversations for the same project.
- Preserve an audit trail of memory reads and writes through `execution_events`.
- Include memory summaries in the supervisor decision brief without dumping every file every turn.
- Avoid file-based routing.
- Do not create branches or worktrees for this work.

## Non-Goals

- Replacing conversation history, worker history, compacted supervision memory, or `execution_events`.
- Building semantic search or embeddings.
- Building a memory editing UI in this milestone.
- Letting the supervisor write arbitrary project files through the memory tools.
- Syncing memory across projects.
- Making SQLite the canonical memory store.
- Designing multi-user memory permissions.

## Product View

### Primary User

The primary user is the human builder running repeated OmniHarness conversations against the same project. They want the supervisor to remember durable project facts without being reminded every run.

### Core Job

The supervisor needs durable project context such as:

- project conventions,
- architectural decisions,
- recurring gotchas,
- preferred verification commands,
- known slow tests or flaky areas,
- unresolved project questions,
- user preferences that apply to this project,
- prior implementation lessons that should affect future supervision.

This should survive new conversations and supervisor context compaction.

### North Star

Each project carries its own living supervisor notebook. A new run should feel like the supervisor has worked in the project before, while still requiring evidence before acting on stale or risky memory.

## Memory Location

Memory lives under the run project path:

```text
<projectPath>/.omniharness/memory/
```

The first implementation should create the directory lazily when a memory write or append occurs. Reads and lists should handle a missing directory as empty memory.

The `.omniharness` directory is project-owned. Everything relevant to one project should live there unless it is conversation-specific app state that already belongs in `sqlite.db`.

## File Layout

Use a small directory of focused files instead of one large memory blob.

Recommended initial files:

```text
.omniharness/memory/overview.md
.omniharness/memory/project-conventions.md
.omniharness/memory/decisions.md
.omniharness/memory/gotchas.md
.omniharness/memory/open-questions.md
.omniharness/memory/verification.md
```

The supervisor tools should not require these exact files to exist. They are conventions and prompt guidance, not a hard schema.

### File Semantics

- `overview.md`: stable description of the project, important subsystems, and current high-level direction.
- `project-conventions.md`: coding, architecture, testing, UX, and repo workflow conventions.
- `decisions.md`: durable decisions with dates and short rationale.
- `gotchas.md`: traps, failures, race conditions, environment issues, and known sharp edges.
- `open-questions.md`: unresolved project questions or decisions that need user input later.
- `verification.md`: known commands, useful scripts, environment notes, and validation expectations.

## Supervisor Tools

Add file-backed memory tools to `buildSupervisorTools`.

### `memory_list`

Lists memory files under `.omniharness/memory/`.

Input:

```ts
{}
```

Output event details should include file paths, sizes, and modification times.

### `memory_read`

Reads a memory file.

Input:

```ts
{
  path: string;
}
```

The path is relative to `.omniharness/memory/`.

### `memory_write`

Replaces a memory file with provided content.

Input:

```ts
{
  path: string;
  content: string;
  reason?: string;
}
```

Use this for intentional rewrites, cleanup, or structured replacement.

### `memory_append`

Appends content to a memory file.

Input:

```ts
{
  path: string;
  content: string;
  reason?: string;
}
```

Use this for ordinary memory updates, especially timestamped notes.

## Path Safety

All memory tool paths must stay inside:

```text
<projectPath>/.omniharness/memory/
```

Rules:

- reject absolute paths,
- reject `..` traversal,
- reject empty paths,
- reject paths containing NUL bytes,
- normalize path separators,
- allow only regular files,
- restrict v1 writes to `.md`, `.txt`, and `.json`,
- do not follow symlinks that escape the memory root,
- require a run `projectPath`; if absent, memory tools should fail with a clear supervisor protocol error.

This keeps memory writes separate from arbitrary repository edits.

## Size Limits

Use conservative limits so memory cannot silently eat the supervisor context window.

Suggested v1 limits:

- max single read content returned to the supervisor: `60_000` characters,
- max single write or append payload: `60_000` characters,
- max memory summary included in decision brief: `2_000` to `3_000` characters,
- max files listed in the decision brief summary: `12`,
- max file size included in summary extraction: inspect metadata first and read selectively.

If content is truncated, event details and tool results should say so.

## Context Flow

### Build Turn Context

Extend `buildSupervisorTurnContext` with memory metadata:

```ts
projectMemory: {
  root: string | null;
  files: Array<{
    path: string;
    size: number;
    updatedAt: string;
  }>;
  recentReads: Array<{
    path: string;
    content: string;
    truncated: boolean;
  }>;
  recentWrites: Array<{
    path: string;
    operation: "write" | "append";
    reason: string | null;
  }>;
}
```

The context builder should list memory files by metadata but not read all file bodies every turn.

### Build Prompt Bundle

Extend `buildSupervisorModelMessages` with a short memory section:

```text
Project memory:
- root: <projectPath>/.omniharness/memory
- files: overview.md, decisions.md, gotchas.md
- recent memory reads/writes: ...
```

If recent memory reads exist, summarize them like existing `supervisor_file_read` evidence. Raw full memory bodies should only enter the prompt after the supervisor explicitly calls `memory_read`.

## Prompt Contract

Update `src/server/prompts/supervisor.md` with rules:

- Treat project memory as durable project-level context, not a transcript.
- Use memory for conventions, decisions, gotchas, verification commands, unresolved questions, and reusable lessons.
- Do not store temporary worker chatter, raw logs, routine progress, or secrets.
- Before spawning or steering workers, consult memory when the task touches project conventions, prior decisions, known gotchas, or verification.
- If memory conflicts with the latest user message, the latest user message wins.
- If memory appears stale or risky, gather evidence before acting on it.
- When a new durable lesson emerges, update memory with `memory_append` or `memory_write`.
- Prefer appending dated notes for new facts; use writes for cleanup or replacing clearly stale sections.

## Event Audit Trail

Persist memory tool activity as execution events:

- `supervisor_memory_listed`
- `supervisor_memory_read`
- `supervisor_memory_written`
- `supervisor_memory_appended`

Event details should include:

- summary,
- memory path,
- absolute path,
- operation,
- reason when provided,
- byte or character counts,
- truncation status,
- errors if relevant.

Memory operations should not add main conversation messages.

## Error Handling

Memory tool failures should produce clear `SupervisorProtocolError` messages for model-visible mistakes:

- no project path,
- invalid path,
- unsupported extension,
- path escapes memory root,
- file does not exist for read,
- target is not a file,
- content too large,
- filesystem read or write failure.

Unexpected errors should still flow through the existing run failure handling so failures stay visible and debuggable.

## Acceptance Criteria

- A project with no `.omniharness/memory/` directory is treated as having empty memory.
- The supervisor can list memory files through `memory_list`.
- The supervisor can read a project memory file through `memory_read`.
- The supervisor can create or replace a memory file through `memory_write`.
- The supervisor can append to a memory file through `memory_append`.
- Memory writes create `.omniharness/memory/` lazily under the run project path.
- Memory tools cannot read or write outside `.omniharness/memory/`.
- Memory tool activity is persisted in `execution_events`.
- Recent memory reads and writes are available to subsequent supervisor wakes.
- The supervisor decision brief includes memory metadata without dumping all memory contents.
- The supervisor prompt explains when memory should be read, trusted, updated, or ignored.
- Existing `read_file`, `inspect_repo`, worker supervision, and conversation behavior continue to work.

## Testing Strategy

Add focused unit tests for:

- memory path resolution and escape prevention,
- missing memory directory behavior,
- file creation on write and append,
- read truncation,
- unsupported extension rejection,
- `buildSupervisorTools` exposing the new memory tools,
- `Supervisor.run()` executing each memory tool and persisting the expected event,
- `buildSupervisorTurnContext` carrying memory metadata and recent memory events,
- `buildSupervisorModelMessages` including memory metadata under budget,
- prompt text mentioning durable project memory behavior.

## Later Milestones

- Add a UI panel for `.omniharness/memory/` files.
- Add memory templates for new projects.
- Add optional memory compaction or cleanup suggestions.
- Add a CLI command for inspecting project memory.
- Let workers receive a concise memory pointer in their initial prompts.
- Add project-level policy files under `.omniharness/` beyond supervisor memory.
