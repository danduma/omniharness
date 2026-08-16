export interface ComposerTextareaLike {
  style: { height: string };
  readonly scrollHeight: number;
  readonly clientHeight: number;
  scrollTop: number;
}

/**
 * Resize to the full content height and let the textarea's responsive CSS
 * max-height decide how much of that content is visible. Preserving scrollTop
 * keeps the browser's native caret-following decision across the measurement.
 */
export function resizeComposerTextarea(textarea: ComposerTextareaLike) {
  const previousScrollTop = textarea.scrollTop;

  textarea.style.height = "auto";
  const contentHeight = textarea.scrollHeight;
  textarea.style.height = `${contentHeight}px`;

  if (contentHeight > textarea.clientHeight) {
    const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
    textarea.scrollTop = Math.min(previousScrollTop, maxScrollTop);
  }
}
