/**
 * Move focus to the main conversation composer. Uses the composer's stable
 * `data-composer-input` hook, the same one the planning panel relies on, so
 * the office view needs no ref threaded through the page tree.
 */
export function focusConversationComposer(root: Pick<Document, "querySelector"> | null = typeof document === "undefined" ? null : document) {
  const input = root?.querySelector<HTMLTextAreaElement>("[data-composer-input='true']") ?? null;
  if (!input) return false;
  input.focus();
  return true;
}
