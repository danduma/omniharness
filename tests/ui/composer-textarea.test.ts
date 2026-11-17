import { expect, test } from "vitest";
import { resizeComposerTextarea, restoreKeyboardAfterSpellcheckReplacement } from "@/lib/composer-textarea";

interface TestTextarea {
  style: { height: string };
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}

function createTextarea(overrides: Partial<TestTextarea> = {}): TestTextarea {
  return {
    style: { height: "100px" },
    scrollHeight: 400,
    clientHeight: 100,
    scrollTop: 180,
    ...overrides,
  };
}

test("composer autosize preserves the browser-managed scroll position while content overflows", () => {
  const textarea = createTextarea();

  resizeComposerTextarea(textarea);

  expect(textarea.style.height).toBe("400px");
  expect(textarea.scrollTop).toBe(180);
});

test("composer autosize clamps a preserved scroll position to the resized content range", () => {
  const textarea = createTextarea({ scrollTop: 240 });

  resizeComposerTextarea(textarea);
  expect(textarea.scrollTop).toBe(240);

  textarea.scrollHeight = 260;
  resizeComposerTextarea(textarea);

  expect(textarea.style.height).toBe("260px");
  expect(textarea.scrollTop).toBe(160);
});

test("composer autosize uses the natural measured height when content does not overflow", () => {
  const textarea = createTextarea({ scrollHeight: 72, clientHeight: 72, scrollTop: 0 });

  resizeComposerTextarea(textarea);

  expect(textarea.style.height).toBe("72px");
  expect(textarea.scrollTop).toBe(0);
});

function createKeyboardTextarea() {
  const attributes = new Map<string, string>();
  const policyAtShow: Array<string | undefined> = [];
  let focusCount = 0;
  const textarea = {
    focus: () => { focusCount += 1; },
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    removeAttribute: (name: string) => { attributes.delete(name); },
  };
  const virtualKeyboard = { show: () => { policyAtShow.push(attributes.get("virtualkeyboardpolicy")); } };
  return { textarea, attributes, policyAtShow, virtualKeyboard, focusCount: () => focusCount };
}

test("re-shows the keyboard after an Android spellcheck replacement", () => {
  const { textarea, attributes, policyAtShow, virtualKeyboard, focusCount } = createKeyboardTextarea();

  const shown = restoreKeyboardAfterSpellcheckReplacement(textarea, "insertReplacementText", {
    virtualKeyboard,
    isActiveElement: () => true,
  });

  expect(shown).toBe(true);
  expect(policyAtShow).toEqual(["manual"]);
  expect(attributes.has("virtualkeyboardpolicy")).toBe(false);
  expect(focusCount()).toBe(0);
});

test("refocuses the textarea when the suggestion menu took focus", () => {
  const { textarea, virtualKeyboard, focusCount } = createKeyboardTextarea();

  restoreKeyboardAfterSpellcheckReplacement(textarea, "insertReplacementText", {
    virtualKeyboard,
    isActiveElement: () => false,
  });

  expect(focusCount()).toBe(1);
});

test("ignores ordinary typing and browsers without the VirtualKeyboard API", () => {
  const { textarea, policyAtShow, virtualKeyboard } = createKeyboardTextarea();

  expect(restoreKeyboardAfterSpellcheckReplacement(textarea, "insertText", {
    virtualKeyboard,
    isActiveElement: () => true,
  })).toBe(false);
  expect(restoreKeyboardAfterSpellcheckReplacement(textarea, "insertReplacementText", {
    virtualKeyboard: undefined,
    isActiveElement: () => true,
  })).toBe(false);
  expect(policyAtShow).toEqual([]);
});
