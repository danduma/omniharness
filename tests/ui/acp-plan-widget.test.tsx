import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AcpPlanWidgetContent } from "@/components/home/AcpPlanWidget";
import { shouldRenderUnifiedStreamEntry } from "@/components/Terminal";
import type { WorkerPlanSnapshot } from "@/shared/acp-plan";
import type { WorkerEntry } from "@/shared/worker-entries";

const plan: WorkerPlanSnapshot = {
  runId: "run-1",
  workerId: "worker-1",
  acpSessionId: "session-1",
  planBoundarySeq: 4,
  lastEntrySeq: 5,
  lastAcceptedEntryId: "plan-5",
  visible: true,
  items: [
    { id: "4:0", content: "Inspect source", priority: "high", status: "completed", order: 0 },
    { id: "4:1", content: "Implement widget", priority: "medium", status: "in_progress", order: 1 },
  ],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("AcpPlanWidget", () => {
  it("renders compact progress and an accessible non-submit expansion control", () => {
    const html = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded={false} onToggle={vi.fn()} />,
    );

    expect(html).toContain("Plan");
    expect(html).toContain("1 of 2 complete");
    expect(html).toContain("Implement widget");
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Inspect source");
  });

  it("makes the entire plan header a native toggle in both states", () => {
    const collapsedHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded={false} onToggle={vi.fn()} />,
    );
    const expandedHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded onToggle={vi.fn()} />,
    );

    expect(collapsedHtml).toContain('data-testid="acp-plan-surface-trigger"');
    expect(collapsedHtml).toContain('type="button"');
    expect(collapsedHtml).toContain('aria-expanded="false"');
    expect(collapsedHtml).toContain("w-full");
    expect(expandedHtml).toContain('data-testid="acp-plan-surface-trigger"');
    expect(expandedHtml).toContain('aria-expanded="true"');
    expect(expandedHtml.match(/type="button"/g)).toHaveLength(1);
  });

  it("keeps expanded rows visually minimal while preserving semantic status and priority", () => {
    const html = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded onToggle={vi.fn()} />,
    );

    expect(html).toContain("<ol");
    expect(html).toContain("Inspect source");
    expect(html).toContain('<span class="sr-only">Completed</span>');
    expect(html).toContain('<span class="sr-only">High priority</span>');
    expect(html).toContain('<span class="sr-only">In progress</span>');
    expect(html).toContain('<span class="sr-only">Medium priority</span>');
    expect(html).not.toContain('aria-hidden="true">·</span>');
    expect(html).toContain('aria-expanded="true"');
  });

  it("shows in-progress items with a same-size spinning status icon", () => {
    const expandedHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded onToggle={vi.fn()} />,
    );
    const collapsedHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded={false} onToggle={vi.fn()} />,
    );

    for (const html of [expandedHtml, collapsedHtml]) {
      expect(html).toContain("lucide-loader-circle");
      expect(html).toContain("size-3.5 animate-spin");
      expect(html).toContain("motion-reduce:animate-none");
      expect(html).not.toContain("lucide-circle-dot");
    }
  });

  it("shows the completed checklist during its dismissal transition", () => {
    const html = renderToStaticMarkup(
      <AcpPlanWidgetContent
        plan={{ ...plan, items: plan.items.map((item) => ({ ...item, status: "completed" as const })) }}
        expanded
        completionPhase="fading"
        onToggle={vi.fn()}
      />,
    );

    expect(html).toContain('data-plan-completion="fading"');
    expect(html).toContain("opacity-0");
    expect(html).toContain("Inspect source");
    expect(html).toContain("Implement widget");
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain("lucide-loader-circle");
  });

  it("uses one ultra-dense header and compact expanded rows without decorative chrome", () => {
    const html = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded={false} onToggle={vi.fn()} />,
    );

    expect(html).toContain("Implement widget");
    expect(html).toContain("lucide-list-checks size-3");
    expect(html).not.toContain(">Active<");
    expect(html).toContain("rounded-2xl");
    expect(html).toContain("text-sm font-medium");
    expect(html).toContain("px-2 py-1.5\"");
    expect(html).not.toContain("px-2 py-1\"");
    expect(html).not.toContain('style="width:');
    expect(html).not.toContain("shadow-sm");
    expect(html).not.toContain("size-8");

    const expandedHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded onToggle={vi.fn()} />,
    );
    expect(expandedHtml).toContain("py-1");
    expect(expandedHtml).not.toContain("py-0.5");
    expect(expandedHtml).toContain("text-sm leading-5");
  });

  it("gives same-count accepted updates a new live-announcement identity", () => {
    const before = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={plan} expanded={false} onToggle={vi.fn()} />,
    );
    const after = renderToStaticMarkup(
      <AcpPlanWidgetContent
        plan={{
          ...plan,
          lastEntrySeq: 6,
          lastAcceptedEntryId: "plan-6",
          items: plan.items.map((item) => item.id === "4:1"
            ? { ...item, content: "Verify widget" }
            : item),
        }}
        expanded={false}
        onToggle={vi.fn()}
      />,
    );

    expect(before).toContain("1 of 2 complete");
    expect(after).toContain("1 of 2 complete");
    expect(before).toContain('data-plan-announcement="plan-5"');
    expect(after).toContain('data-plan-announcement="plan-6"');
  });

  it("distinguishes a valid empty plan from a reset tombstone", () => {
    const emptyHtml = renderToStaticMarkup(
      <AcpPlanWidgetContent plan={{ ...plan, items: [] }} expanded onToggle={vi.fn()} />,
    );
    expect(emptyHtml).toContain("No plan steps yet");
    expect(emptyHtml).not.toContain("aria-controls");
    expect(emptyHtml).not.toContain("aria-expanded");
  });

  it("suppresses accepted rows only on the proven widget-owned surface", () => {
    const accepted = {
      id: "accepted",
      seq: 2,
      type: "plan",
      text: "Inspect",
      timestamp: "2026-01-01T00:00:00.000Z",
      planProjection: "accepted_core",
    } satisfies WorkerEntry;
    const diagnostic = {
      ...accepted,
      id: "diagnostic",
      planProjection: "rejected",
      diagnosticOnly: true,
    } satisfies WorkerEntry;

    expect(shouldRenderUnifiedStreamEntry(accepted, false)).toBe(true);
    expect(shouldRenderUnifiedStreamEntry(accepted, true)).toBe(false);
    expect(shouldRenderUnifiedStreamEntry(diagnostic, false)).toBe(false);
  });
});
