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

interface VirtualKeyboardLike {
  show(): void;
}

export interface SpellcheckKeyboardTextareaLike {
  focus(options?: FocusOptions): void;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

export interface SpellcheckKeyboardEnvironment {
  virtualKeyboard?: VirtualKeyboardLike | null;
  isActiveElement: () => boolean;
}

/**
 * Chrome on Android hides the soft keyboard while its spellcheck suggestion
 * menu is open and does not bring it back after a suggestion is picked, so the
 * user has to tap the textarea again to keep typing. The replacement arrives as
 * an `input` event with `inputType === "insertReplacementText"`; when that
 * happens, re-show the keyboard through the VirtualKeyboard API.
 *
 * `show()` only works while the focused element has
 * `virtualkeyboardpolicy="manual"`, so the policy is flipped for the call and
 * restored right after. The policy only decides whether focus/tap shows the
 * keyboard automatically; restoring it does not hide a visible keyboard.
 */
export function restoreKeyboardAfterSpellcheckReplacement(
  textarea: SpellcheckKeyboardTextareaLike,
  inputType: string | undefined,
  environment: SpellcheckKeyboardEnvironment,
): boolean {
  if (inputType !== "insertReplacementText") return false;
  const virtualKeyboard = environment.virtualKeyboard;
  if (!virtualKeyboard || typeof virtualKeyboard.show !== "function") return false;

  if (!environment.isActiveElement()) {
    textarea.focus({ preventScroll: true });
  }

  const previousPolicy = textarea.getAttribute("virtualkeyboardpolicy");
  textarea.setAttribute("virtualkeyboardpolicy", "manual");
  try {
    virtualKeyboard.show();
  } catch {
    // show() refuses without sticky user activation; the user can still tap to
    // bring the keyboard back, which is the pre-existing behaviour.
    return false;
  } finally {
    if (previousPolicy === null) {
      textarea.removeAttribute("virtualkeyboardpolicy");
    } else {
      textarea.setAttribute("virtualkeyboardpolicy", previousPolicy);
    }
  }
  return true;
}
