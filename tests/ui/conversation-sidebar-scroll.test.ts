import { expect, test } from "vitest";

import { centeredScrollTop, clampScrollTop } from "@/components/home/conversation-sidebar-scroll";

test("a selected row lands in the vertical middle of the list viewport", () => {
  const scrollTop = centeredScrollTop({
    scrollHeight: 2000,
    clientHeight: 600,
    rowTop: 1000,
    rowHeight: 40,
  });

  expect(scrollTop).toBe(720);
  // The row centre sits on the viewport centre, not above it.
  expect(1000 + 40 / 2 - scrollTop).toBe(600 / 2);
});

test("rows near either end settle flush instead of overscrolling", () => {
  expect(centeredScrollTop({ scrollHeight: 2000, clientHeight: 600, rowTop: 20, rowHeight: 40 })).toBe(0);
  expect(centeredScrollTop({ scrollHeight: 2000, clientHeight: 600, rowTop: 1900, rowHeight: 40 })).toBe(1400);
});

test("a list shorter than its viewport stays at the top", () => {
  expect(centeredScrollTop({ scrollHeight: 300, clientHeight: 600, rowTop: 200, rowHeight: 40 })).toBe(0);
});

test("remembered offsets are clamped to the scrollable range", () => {
  expect(clampScrollTop(5000, 2000, 600)).toBe(1400);
  expect(clampScrollTop(-20, 2000, 600)).toBe(0);
  expect(clampScrollTop(300, 2000, 600)).toBe(300);
});
