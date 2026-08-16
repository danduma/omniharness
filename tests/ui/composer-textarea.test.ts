import { expect, test } from "vitest";
import { resizeComposerTextarea } from "@/lib/composer-textarea";

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
