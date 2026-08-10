# ACP and Workspace Image Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display images emitted through ACP—including images returned by an agent’s image-reading tool—directly inside the durable OmniHarness session conversation.

**Architecture:** ACP image bytes are materialized into run-owned media artifacts. The unified worker JSONL stream stores only typed media references, while the frontend fetches media through an authenticated RuntimeAPI and renders it with managed object URLs.

**Tech Stack:** Next.js/React, TypeScript, ACP session updates, SQLite/Drizzle-backed run ownership, append-only worker JSONL streams, RuntimeAPI adapters, Vitest, lifecycle HTTP/SSE scenarios, existing attachment preview primitives.

**North Star Product:** OmniHarness conversations are durable multimodal transcripts: text, tool output, images, plans, and other ACP content remain correctly ordered, reloadable, inspectable, and recoverable.

**Current Milestone:** Preserve, materialize, persist, serve, and render ACP image content across direct and merged worker conversations, including tool-returned workspace images.

**Final Functionality Standard:** A realistic image larger than 4 KB emitted through ACP renders inline beside its originating activity, survives reload/reconnect/restart/reattach, is fetched from the correct worker, has visible localized failure states, and is removed with its owning conversation without leaving corrupted base64 in the worker transcript.

---

## Product decisions and scope

- Support ACP images from `agent_message_chunk`, `agent_thought_chunk`, and `user_message_chunk`.
- Support images nested in `tool_call.content[]` and `tool_call_update.content[]`.
- Images returned by a read-image tool appear adjacent to that tool activity.
- Support ACP `data` payloads and safe local/data URIs.
- Do not server-fetch arbitrary remote URLs. External HTTPS images remain links unless a separate remote-image policy is approved.
- Store binary image data as run-owned artifacts, not as base64 inside transcript JSONL.
- Reuse the existing full-screen attachment preview dialog for enlargement and download.
- Add Markdown `![alt](url)` support for safe same-origin/HTTPS URLs. Arbitrary workspace paths remain links unless server-materialized through the ACP media path.
- Preserve existing text, audio, resource, tool, attachment, and legacy output behavior.
- Do not introduce new settings or user preferences; media caching is transient and intentionally non-persistent.

## Current gaps

- ACP non-text content is captured as `agent_content`, but the unified `Terminal` path currently drops those entries.
- The existing image renderer only handles the legacy raw-base64 path.
- Live raw ACP payloads are truncated to 4,000 characters.
- Persisted worker-stream raw values are also truncated, corrupting normal image base64.
- The merged transcript adds `workerId`, but individual media references currently have no explicit ownership metadata.
- The existing attachment URL manager handles user uploads but not worker-generated media.

## File map

### New files

- `src/server/workers/media-store.ts`: Validate, hash, atomically write, and read run-owned image artifacts.
- `src/runtime/http/routes/worker-media.ts`: Authenticated worker-media HTTP route.
- `src/components/terminal/ProtocolActivityContent.tsx`: Extracted protocol-content rendering from `Terminal.tsx`.
- `src/components/terminal/AgentImageContent.tsx`: Worker-media image loading, rendering, retry, accessibility, preview, and download.
- Worker-media manager/hook module under the existing frontend Manager conventions: transient Blob/ObjectURL state, scoped caching, deduplicated fetches, and lifecycle ownership.
- `tests/server/workers/media-store.test.ts`: Media-store validation, hashing, limits, idempotency, URI policy, and malformed-input coverage.
- New worker-media route tests and worker-media manager tests at the repository’s established test locations.

### Existing files to modify

- `src/shared/worker-entries.ts`: Add typed worker media references and media-bearing entry fields.
- `src/server/agent-runtime/types.ts`: Add runtime-side media/source types and bounded ACP payload projections.
- `src/server/agent-runtime/acp/session-updates.ts`: Normalize image-bearing ACP update and tool-content variants without dropping non-image content.
- `src/server/agent-runtime/acp/runtime-client.ts`: Preserve tool-call identity/content association and complete image payloads until materialization.
- `src/server/agent-runtime/output-store.ts`: Remove image corruption caused by generic truncation and carry media source context through the bridge.
- `src/server/workers/output-store.ts`: Materialize images before fingerprinting/compaction and persist only sanitized media references.
- `src/runtime/http` route registration: Register the worker-media endpoint.
- `src/runtime-api/types.ts`: Add the `workers.media()` Blob contract.
- `src/runtime-api/domains/index.ts`: Implement the shared runtime-domain adapter.
- Web, Electron, VS Code, and Capacitor RuntimeAPI adapters: Implement the media Blob method and contract coverage.
- `src/components/Terminal.tsx`: Forward unified `agent_content` and `user_content` through the shared protocol renderer; keep the file from growing further.
- `src/components/MarkdownContent.tsx`: Recognize and safely render supported Markdown image URLs before normal link handling.
- Existing `AttachmentImagePreviewDialog` and manager: Reuse for worker-media preview and download.
- `src/server/events/named-events.ts`: Add worker-media lifecycle and failure event types/codes.
- `shared/locales/*.json`: Add image loading, retry, unavailable, failure, alt, and download/preview labels to every locale.
- Relevant architecture, stream, route, and lifecycle test files identified during implementation.

### Tests to create or extend

- `tests/server/acp/session-updates.test.ts`
- `tests/server/acp/runtime-client.test.ts`
- `tests/server/agent-runtime/output-store.test.ts`
- `tests/server/workers/media-store.test.ts`
- `tests/server/workers/output-store.test.ts`
- Worker-media route tests covering authentication, ownership, traversal, missing/corrupt artifacts, MIME, and cache headers.
- `tests/app/acp/protocol-activity.test.ts`
- `tests/lib/agent-output.test.ts`
- `tests/app/worker-entries-manager.test.ts`
- Worker-media manager tests for deduplication, release, stale owners, errors, and retry.
- `tests/ui/markdown-content.test.ts`
- Terminal/UI tests for unified and merged rendering, preview, download, and keyboard accessibility.
- A lifecycle scenario under `tests/lifecycle/scenarios/` covering image materialization, disconnect/reconnect, restart/reattach, reload, deletion, and late-write prevention.

### Product verification and hygiene

- Candidate approval-gated agentic journey: start a direct conversation, ask the agent to inspect a known PNG fixture, verify the image beside the read tool result, reload, paginate, switch runs, preview, download, reconnect, and verify no duplicate. Do not run this journey without explicit user approval.
- Use the already-running application when testing; do not start another server if one exists.
- Work directly in the current repository. Do not create a branch or worktree.
- Preserve unrelated dirty-worktree changes.
- Verify `.gitignore` covers secrets, local environment files, dependencies, caches, build output, logs, temporary files, and generated runtime artifacts.
- Clean up test conversations and associated persisted artifacts before finishing.

## Client/server state invariants

- Worker JSONL remains the single transcript source of truth.
- Binary media is referenced by the transcript but is not a second transcript.
- `seq` determines transcript ordering.
- `entry.id` and content identity determine revision/dedup behavior.
- `mediaId` determines immutable binary identity.
- Merged entries always carry the originating `workerId`; media requests never infer ownership from the currently selected worker.
- SSE only wakes the client with `{workerId, seq}`; it never carries image bytes.
- Cached transcript entries are not authoritative until the stream manager validates their cursor range.
- Media fetches cannot mutate state after the owning worker/run selection changes.
- Missing media is an explicit visible state, never a silent blank.
- Partial or stale snapshots cannot erase known media references.
- Conversation deletion removes all media owned by the run.
- Server owns media bytes; worker transcript owns durable references; `WorkerMediaUrlManager` owns only transient Blob/ObjectURL state.
- Object URLs are client-only and never persisted.
- Media fetches are deduplicated by `workerId + mediaId`, bounded, reference-counted, and safe against late completion after unmount or owner change.

## Task 1: Define the media contract

- [ ] Add a typed `WorkerEntryMedia` shape, for example:

  ```ts
  type WorkerEntryMedia = {
    id: string;
    workerId: string;
    kind: "image";
    mimeType: string;
    sizeBytes: number;
    filename?: string | null;
    altText?: string | null;
    status: "ready" | "unavailable";
    reasonCode?: string | null;
  };
  ```

- [ ] Add `media?: WorkerEntryMedia[]` to worker and agent output entries while preserving stable serialization and backwards compatibility with older entries.
- [ ] Make `media.id` immutable and content-addressed; never persist base64 or object URLs in the reference.
- [ ] Preserve explicit `workerId` ownership on every reference, including merged transcripts.
- [ ] Write tests for valid/invalid references, stable serialization, stream revisions, and ownership preservation.
- [ ] Verify legacy entries still parse and render unchanged.

## Task 2: Preserve and normalize ACP image content

- [ ] Add failing tests for images in agent, thought, and user chunks; images nested in tool calls and tool-call updates; content ordering; tool-call identity; and non-image blocks remaining intact.
- [ ] Normalize every supported image-bearing ACP path into the unified worker stream representation.
- [ ] Preserve `toolCallId`, content position, message identity, and source context wherever ACP provides them.
- [ ] Use `agent_content`/`user_content` entries so images stay correctly ordered with adjacent text and tool activity.
- [ ] Update runtime output-store transport bounds to special-case image payloads.
- [ ] Preserve a complete image payload up to the configured worker-media limit; never head/tail truncate base64.
- [ ] Mark an image unavailable when it exceeds the limit rather than emitting corrupted or partial data.
- [ ] Keep generic diagnostic strings bounded as they are today.
- [ ] Verify structured content is not silently dropped and normal text/tool output remains bounded.

## Task 3: Add run-owned worker media storage

- [ ] Create `src/server/workers/media-store.ts` with storage under the existing run artifact root:

  ```text
  <run artifact root>/workers/<workerId>/media/<content-hash>.<extension>
  ```

- [ ] Accept only supported raster image MIME types and enforce a maximum image size.
- [ ] Decode raw ACP base64 and `data:` URIs; reject malformed or partial base64.
- [ ] Hash bytes with SHA-256 and make repeated writes idempotent.
- [ ] Use atomic temporary-file write plus rename.
- [ ] Derive extensions from an allowlisted MIME map; do not trust filenames or MIME query parameters.
- [ ] Prevent path traversal and restrict local URI reads to the worker `cwd` and configured additional directories.
- [ ] Never fetch arbitrary HTTP URLs server-side.
- [ ] Pass `cwd`, additional directories, run identity, and worker identity into worker-output materialization where required.
- [ ] Before fingerprinting and `compactEntryForHistory()`, find image blocks, materialize their bytes, replace raw payloads with typed media references, and persist only the sanitized entry.
- [ ] Preserve an explicit unavailable-image reference when materialization fails; do not drop the enclosing tool result or conversation entry.
- [ ] Add tests for hashing, MIME validation, size limits, atomic/idempotent writes, local URI allowlists, malformed data, and cleanup ownership.

## Task 4: Add the authenticated media endpoint

- [ ] Create `GET /api/workers/:workerId/media/:mediaId` and register it through the runtime HTTP route system.
- [ ] Require the existing API session.
- [ ] Resolve the worker and owning run server-side; resolve the artifact root from trusted database metadata.
- [ ] Validate `mediaId` against a strict hash/extension pattern and reject traversal/cross-worker access.
- [ ] Return the stored MIME type with `Content-Disposition: inline`.
- [ ] Use private immutable caching for content-addressed media.
- [ ] Surface missing/corrupt artifacts as typed errors without exposing sensitive paths.
- [ ] Emit named failure events for relevant failures.
- [ ] Add `workers.media({ workerId, mediaId }): Promise<Blob>` to `src/runtime-api/types.ts` and all runtime adapters.
- [ ] Add adapter-contract tests for web, Electron, VS Code, and Capacitor.

## Task 5: Wire unified transcript rendering

- [ ] Add projection tests showing unified `agent_content` and `user_content` entries produce image protocol activities rather than being dropped.
- [ ] Update `Terminal.tsx` to use the shared bridge-entry type guard and forward protocol content through `buildAgentOutputActivity()`.
- [ ] Extract the existing `ProtocolActivityContent` from `Terminal.tsx` into a focused module.
- [ ] Implement `AgentImageContent` with loading, successful inline rendering, unavailable/error states, retry, localized alt text, bounded responsive dimensions, intrinsic dimensions where available, keyboard-accessible click-to-preview, and full-size download.
- [ ] Reuse `AttachmentImagePreviewDialog` and its manager rather than adding a second preview state system.
- [ ] Keep the legacy raw-data renderer capable of rendering safe unmaterialized `data` blocks temporarily, while the normal unified path uses media references.
- [ ] Verify worker-card, selected-worker, merged-conversation, pagination, reload, and revision/coalescing render paths.

## Task 6: Add frontend media state ownership

- [ ] Create a `WorkerMediaUrlManager` following the existing attachment URL manager pattern.
- [ ] Cache by `workerId + mediaId`; deduplicate concurrent fetches; track reference counts; and revoke object URLs when no longer referenced.
- [ ] Abort or ignore stale requests when the conversation or worker changes.
- [ ] Keep cache size bounded and never write media bytes to localStorage.
- [ ] Track error state separately from loading state and expose retry through Manager methods.
- [ ] Add narrow subscriptions so components observe only the media keys they render.
- [ ] Add tests for concurrent request deduplication, object URL release, owner changes, late completion after unmount, duplicate stream entries, reconnect refetch behavior, and retry.

## Task 7: Add safe Markdown image compatibility

- [ ] Update `MarkdownContent.tsx` to recognize image syntax before ordinary link syntax.
- [ ] Render HTTPS images with `referrerPolicy="no-referrer"`.
- [ ] Render same-origin worker-media URLs through the shared image component/preview path.
- [ ] Reject `javascript:`, arbitrary filesystem paths, and `data:` URLs except for server-generated safe media references.
- [ ] Render unsupported local paths as ordinary links.
- [ ] Keep Markdown image rendering separate from ACP structured image rendering so tool-read images remain authoritative structured content.
- [ ] Add localized alt/loading/failure text and tests for safe and unsafe URL cases.

## Task 8: Add lifecycle observability, cleanup, and failure transparency

- [ ] Add named events such as `worker.media_materialized`, `worker.media_unavailable`, and `worker.media.read_failed` through `emitNamedEvent`.
- [ ] Add stable `error.surfaced` codes for malformed image payloads, unsupported MIME types, oversized images, unreadable local URIs, missing artifacts, unauthorized access, and failed media fetches.
- [ ] Include `runId`, `workerId`, `mediaId` when available, safe MIME/size metadata, stable reason code, and source (`agent_message`, `tool_output`, or `uri`); never include image bytes.
- [ ] Materialize before appending the corresponding worker entry.
- [ ] Do not recreate a deleted run artifact root.
- [ ] Wait for in-flight writes before final run cleanup; verify restart/reattach can read existing media.
- [ ] Verify deletion removes media and cannot be followed by a late append.
- [ ] Add lifecycle coverage for: image emitted by a read tool; materialization and `worker.entry_appended`; disconnect during media fetch; reconnect from an existing stream cursor; transcript/media reload; worker restart/reattach; deletion; and absence of late-write recreation.
- [ ] Read and follow `docs/architecture/lifecycle-observability-and-testing.md` before adding server-side state transitions.

## Task 9: Complete verification and handoff

- [ ] Run focused ACP, media-store, worker-output, route, projection, Markdown, Manager, and UI tests while implementing each task.
- [ ] Run `pnpm test:lifecycle` for the lifecycle scenario.
- [ ] Run the repository’s applicable typecheck, lint, build, full test suite, and `git diff --check`.
- [ ] Confirm a realistic image larger than 4 KB renders from `agent_message_chunk`.
- [ ] Confirm an image inside `tool_call_update.content` renders adjacent to the tool activity.
- [ ] Confirm images survive reload, pagination, reconnect, worker restart, and worker reattachment.
- [ ] Confirm multi-worker transcripts fetch from the originating worker and conversation switching cannot show stale media.
- [ ] Confirm oversized, malformed, unsupported, missing, and unauthorized images show localized visible states.
- [ ] Confirm named events and `error.surfaced` records are observable through the project’s event log path.
- [ ] Confirm persisted worker JSONL contains media references rather than full image base64.
- [ ] Confirm deletion removes media artifacts and no test conversations/artifacts remain.
- [ ] Confirm all new frontend copy exists in every locale file.
- [ ] Propose the real-browser approval-gated journey; do not run it without explicit approval.

## Acceptance criteria

- [ ] A realistic image larger than 4 KB emitted through `agent_message_chunk` renders inline.
- [ ] A realistic image returned inside `tool_call_update.content` renders adjacent to the tool activity.
- [ ] Images survive reload, pagination, reconnect, worker restart, and worker reattachment.
- [ ] Multi-worker transcripts request media from the correct originating worker.
- [ ] Selecting another conversation cannot display stale media from the previous conversation.
- [ ] Oversized, malformed, unsupported, missing, and unauthorized images show localized visible states.
- [ ] Media failures are observable through named events and `error.surfaced`.
- [ ] Conversation deletion removes media artifacts.
- [ ] Persisted worker JSONL contains references, not full base64 image data.
- [ ] Existing text, audio, resource, tool, attachment, and legacy output behavior remains intact.
- [ ] All new frontend copy exists in every `shared/locales/*.json` file.
- [ ] No new settings or user preferences are introduced; media caching is transient and intentionally non-persistent.
