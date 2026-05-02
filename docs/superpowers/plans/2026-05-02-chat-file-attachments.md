# Chat File Attachments And Image Paste Implementation Plan

> **For implementation workers:** Do not start until this plan is handed off. Follow the repository conventions in `AGENTS.md`: no branches, no file-based routing, no `require()`, and keep React data structures centralized in Manager classes.

**Goal:** Add arbitrary local file attachments and pasted image attachments to OmniHarness chat, with inline previews, removable staged pills, double-height composer behavior, persistence on sent messages, and backend file paths agents can inspect.

**Architecture:** Replace the project-file attachment picker with a native browser file-input flow plus clipboard-image ingestion. Store staged attachment state in `HomeUiStateManager`, upload raw browser files to an authenticated Next.js API route before message submission, persist attachment descriptors on `messages.attachments_json`, and append attachment context to worker prompts through the existing conversation creation/send-message pipeline.

**Current Milestone:** Ship the first complete attachment loop for new and existing conversations: select/paste, preview, remove, upload, send, persist, render after reload, and include file paths in agent-visible context.

## Implementation Tasks

- [ ] Define shared attachment types and persistence fields.
  Add a reusable `ChatAttachment`/`PendingChatAttachment` type in an appropriate shared module, extend `MessageRecord`, update `src/server/db/schema.ts` with `attachmentsJson`, and add the matching `CREATE TABLE`/`ALTER TABLE` support in `src/server/db/index.ts`. Keep browser-only `File` and `previewUrl` fields out of persisted JSON.
  Verification:
  - Update `tests/db/schema.test.ts` to assert `messages.attachmentsJson` exists.

- [ ] Add authenticated attachment upload support.
  Create a standard App Router API route such as `src/app/api/attachments/route.ts` that accepts `multipart/form-data`, validates count/size, sanitizes filenames, writes files under app data using generated IDs, and returns durable descriptors with `storagePath`, `name`, `mimeType`, `size`, and `kind`.
  Verification:
  - Add an API test covering successful multi-file upload, empty upload rejection, and oversized file rejection if a limit helper is added.

- [ ] Extend conversation APIs and server message handling.
  Update `/api/conversations` and `/api/conversations/[id]/messages` request parsing to accept attachment descriptors. Extend `createConversation` and `sendConversationMessage` to persist attachments on user messages and include attachment context in initial/follow-up worker prompts. Keep existing ad-hoc plan attachment formatting backward-compatible while adding richer metadata when present.
  Verification:
  - Update `tests/api/conversations-route.test.ts` and `tests/api/conversation-messages-route.test.ts` for attachment-bearing requests.
  - Add/adjust server tests for prompt formatting if adjacent coverage exists.

- [ ] Replace project picker state with native file staging.
  Remove `FileAttachmentPickerDialog` from `HomeApp` if it has no remaining call sites. Add manager methods on `HomeUiStateManager` for adding selected files, adding pasted images, removing attachments, clearing attachments, and cleaning up preview object URLs. Preserve the manager as the single source of truth.
  Verification:
  - Update or replace `tests/ui/file-attachment-picker-dialog.test.ts` with manager/composer assertions for native file-input behavior.

- [ ] Update the composer UI and keyboard/paste behavior.
  In `ConversationComposer`, wire the `+` button to a hidden `input type="file" multiple`, handle paste events for image clipboard items, render image thumbnails and non-image filename pills, keep the `X` removal button on every staged item, and toggle the composer/input minimum height to roughly double while attachments exist. Show the `+` button for both new conversations and selected runs.
  Verification:
  - Update `tests/ui/composer-shell.test.ts` to assert the hidden file input, paste handler path, attachment previews/pills, removal controls, and height class toggle.

- [ ] Update submit and upload sequencing.
  Allow submits when `command.trim()` is non-empty or staged attachments exist. Before calling `runCommand` or `sendConversationMessage`, upload any staged raw files, pass returned descriptors to the JSON API, keep staged attachments on upload/send failure, and clear command plus attachments only after success. Preserve stop-button semantics when a conversation is stoppable.
  Verification:
  - Add UI or app-level tests for attachment-only send, text-plus-attachment send, upload failure retaining staged files, and successful send clearing staged files.

- [ ] Render persisted attachments in chat history.
  Update the user-message rendering path, likely `src/components/home/UserInputMessage.tsx` and/or `src/components/home/ConversationMain.tsx`, to show persisted image attachments and non-image filename pills after messages are saved and reloaded. Use server-readable paths only as metadata, not as public image URLs unless a safe read endpoint is introduced.
  Verification:
  - Add a UI source/render test that persisted message attachment metadata appears in user-message UI.

- [ ] Run focused validation and cleanup.
  Remove dead imports/components only if they are no longer referenced, keep `@` mention behavior intact, and run focused tests before broader validation.
  Verification:
  - `pnpm test tests/db/schema.test.ts tests/api/conversations-route.test.ts tests/api/conversation-messages-route.test.ts tests/ui/composer-shell.test.ts tests/lib/conversations.test.ts`
  - `pnpm lint`

## Notes And Constraints

- Native file inputs cannot expose local absolute paths, so uploaded copies under app data are required for workers to access selected/pasted files.
- Pasted images may arrive without useful filenames; generate readable names and infer extensions from MIME types.
- Do not send raw `File` objects in JSON; upload first, then send descriptors.
- Keep file previews compact. Images get visual thumbnails; text and other files display filename pills only.
- If a secure attachment read endpoint is needed for persisted image thumbnails, add it deliberately with auth and path validation rather than serving arbitrary local paths.
- Keep existing text-only composer behavior, mention picker behavior, conversation recovery behavior, and stop-button behavior unchanged.

## Self-Review

- [x] The plan covers paste images and native `+` file selection.
- [x] The plan supports arbitrary file types without extension filtering.
- [x] The plan distinguishes image previews from filename-only non-image files.
- [x] The plan preserves removable pills and double-height composer behavior.
- [x] The plan carries attachments through upload, API submission, persistence, reload rendering, and worker-visible context.
- [x] The plan avoids implementation work in this planning handoff.
