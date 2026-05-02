# Chat File Attachments And Image Paste Spec

## Goal
Let users attach arbitrary local files to chat messages from the composer, including pasted clipboard images, with clear inline previews before sending and durable attachment context for agents after sending.

## High-Level Objective
OmniHarness chat should feel like a modern multimodal assistant composer: users can paste screenshots directly, use the `+` button as a simple local file selector, see what is staged, remove mistaken files, and send the message with enough persisted attachment metadata for the receiving worker or supervisor to inspect the files.

## Current State
- `src/components/home/ConversationComposer.tsx` already renders removable attachment pills, but only for initial conversations and only with project-file metadata from `FileAttachmentPickerDialog`.
- `src/components/FileAttachmentPickerDialog.tsx` is a custom project-file browser backed by `/api/fs/files`; it does not open the browser's native file chooser and cannot attach arbitrary files outside the indexed project tree.
- `src/app/home/HomeApp.tsx` stores staged attachments in `HomeUiStateManager`, includes them only when starting a new conversation through `/api/conversations`, and clears them after successful conversation creation.
- `/api/conversations/[id]/messages` and `sendConversationMessage` accept only text content, so follow-up chat messages cannot carry attachments today.
- The `messages` table persists only message text; existing attachment details are written into ad-hoc plan markdown for new runs, not preserved as structured message data.

## In Scope
- Replace the current `+` button behavior in the composer with a hidden native `<input type="file" multiple>` trigger.
- Allow selecting any local file type supported by the browser file picker; do not filter by extension.
- Add paste handling for image files from the clipboard while the composer is focused.
- Stage selected and pasted files in the global home UI manager as the source of truth.
- Show image attachments as small visual previews and non-image files as filename pills.
- Preserve the existing `X` removal affordance for every staged item.
- Grow the composer text area/container to roughly double its current minimum height while one or more files are staged.
- Support attachments for both new conversation messages and follow-up messages in an existing chat.
- Upload staged file contents to the server before sending, persist them under app-managed storage, and send durable attachment descriptors to backend conversation APIs.
- Render sent user-message attachments from persisted message metadata when conversations reload.

## Out Of Scope
- Full document preview or syntax-highlighted text preview; non-images display by filename only.
- Drag-and-drop attachments.
- Remote URL attachments.
- OCR, image resizing beyond safe preview thumbnails, or image-to-text extraction.
- Provider-specific multimodal API integration. Agents receive file paths and metadata first; deeper provider-native image payload support can be added later.

## User Experience
- The `+` button remains visually in the composer toolbar, but it opens the OS/browser file selector directly instead of the project-file dialog.
- Users may select multiple files in one picker session.
- Users may paste one or more screenshots/images into the composer. Pasted non-image text should keep the existing text-input behavior and not create an attachment.
- Each staged image appears as a compact thumbnail with filename and an `X` button.
- Each staged non-image appears as a compact pill with filename, optional size label, and an `X` button.
- Staged attachments persist while the user edits the composer text and are cleared only after a successful send, explicit removal, or starting a new conversation.
- Sending is allowed when there is non-empty text or at least one staged attachment, unless a stop action is currently active.
- If a file upload fails, the message is not sent, staged attachments remain visible, and the user sees the normalized application error.

## Data Model

### Attachment Descriptor
Use a shared TypeScript shape for staged and persisted attachments. Exact naming can vary, but the implementation should include:

```ts
interface ChatAttachment {
  id: string;
  kind: "image" | "file";
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  previewUrl?: string;
}
```

- `previewUrl` is browser-only and should not be serialized to the server.
- `storagePath` is returned by the upload endpoint and points to an app-managed copy readable by workers.
- `kind` is derived from `File.type.startsWith("image/")`.

### Message Persistence
- Add a nullable `attachments_json` column to `messages` in `src/server/db/schema.ts` and the bootstrap SQL/compatibility migration in `src/server/db/index.ts`.
- Extend frontend `MessageRecord` and conversation serialization helpers to include parsed attachment descriptors.
- Store only safe metadata and app-managed `storagePath` values, not browser object URLs or raw binary blobs.

## Backend Behavior
- Add an authenticated upload route, for example `/api/attachments`, that accepts `multipart/form-data` with one or more files.
- Save uploaded files under app data, such as `attachments/<run-or-draft-id>/<attachment-id>-<safe-name>`, using sanitized filenames and generated IDs.
- Return attachment descriptors with `storagePath`, `name`, `mimeType`, `size`, and `kind`.
- Enforce practical size/count limits and return normalized errors for too-large files, empty uploads, and write failures.
- Extend `/api/conversations` to accept already-uploaded attachment descriptors for initial messages.
- Extend `/api/conversations/[id]/messages` and `sendConversationMessage` to accept attachment descriptors for follow-up messages.
- Preserve existing ad-hoc plan attachment formatting, but include richer metadata where available.
- When building prompts for workers, append a concise attachment section containing filename, MIME type, size, and storage path so non-provider-native agents can inspect files by path.

## Frontend Behavior
- Replace `FileAttachmentPickerDialog` usage in `HomeApp` with a native file input owned by the composer/home UI flow. The old dialog may be deleted if no other call sites remain.
- Keep all staged attachment state in `HomeUiStateManager`; do not add independent component-level arrays as source of truth.
- Create object URLs for image previews and revoke them when attachments are removed, sent, or reset.
- Add `onPaste` handling to the composer text area or wrapper. Only clipboard `File`/`Blob` items with image MIME types become attachments.
- Update submit logic so text-only, attachment-only, and text-plus-attachment messages are valid.
- Upload any staged browser `File` objects before calling conversation APIs. Do not include raw `File` objects in JSON requests.
- Render persisted attachments in user messages, likely in `UserInputMessage` or the message rendering branch in `ConversationMain`.
- Apply composer sizing with a simple class toggle: no attachments keeps the current minimum height; attachments increase the text/input area to approximately double height.

## Acceptance Criteria
- Pressing `+` opens a native file selector and allows choosing any file type.
- Selecting files stages them in the composer without immediately sending the message.
- Pasting an image into the composer stages it as an image attachment.
- Staged images show thumbnail previews; staged non-images show filename pills.
- Every staged attachment can be removed with an `X` before send.
- Composer height roughly doubles while attachments are staged and returns to normal after they are cleared.
- Users can send attachment-only messages and text-plus-attachment messages.
- Attachments work for both a new conversation and an existing conversation.
- Sent attachments remain visible after reload because message metadata is persisted.
- Workers receive attachment context containing app-readable file paths.
- Existing project `@` mention behavior and text-only chat behavior continue to work.

## Risks And Constraints
- Browsers do not expose arbitrary local absolute file paths from native file inputs, so selected/pasted files must be uploaded into app-managed storage before workers can read them.
- Clipboard image filenames may be missing; generate stable names such as `pasted-image-<timestamp>.png`.
- Object URLs can leak memory if not revoked; cleanup must be explicit in manager reset/removal flows.
- Very large files can harm local storage and request performance; enforce limits in both UI copy and backend validation.
- Keep React state centralized in manager classes per repository convention.
