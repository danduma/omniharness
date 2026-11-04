import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OfficeView } from "@/interface/office/OfficeView";
import type { AgentSnapshot } from "@/interface/home/types";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";

const workers: ConversationWorkerRecord[] = [
  { id: "worker-a", runId: "run-1", type: "codex", status: "working", workerNumber: 1 },
  { id: "worker-b", runId: "run-1", type: "claude", status: "working", workerNumber: 2 },
  { id: "worker-c", runId: "run-1", type: "gemini", status: "idle", workerNumber: 3 },
];

const agents = new Map<string, AgentSnapshot>([
  ["worker-a", {
    name: "worker-a",
    state: "working",
    pendingPermissions: [{ requestId: 1, requestedAt: "2026-10-07T00:00:00.000Z" }],
  }],
  ["worker-b", { name: "worker-b", state: "working" }],
  ["worker-c", { name: "worker-c", state: "idle" }],
]);

function render() {
  return renderToStaticMarkup(<OfficeView workers={workers} agentsById={agents} onFocusWorker={() => undefined} />);
}

describe("OfficeView", () => {
  it("renders one labelled desk per worker plus the main conversation desk", () => {
    const html = render();
    expect(html).toContain('aria-label="Agent office"');
    expect(html).toContain('aria-label="Main conversation: focus the message composer"');
    expect(html).toContain('aria-label="Worker 1, Codex: Waiting for you"');
    expect(html).toContain('aria-label="Worker 2, Claude Code: Working"');
    expect(html).toContain('aria-label="Worker 3, Gemini: Idle"');
  });

  it("marks activity and animation budget on each desk for CSS", () => {
    const html = render();
    expect(html).toMatch(/data-activity="waiting_user" data-animate="true"/);
    expect(html).toMatch(/data-activity="working" data-animate="true"/);
    expect(html).toMatch(/data-activity="idle" data-animate="false"/);
  });

  it("announces only workers that need the user through the polite live region", () => {
    const html = render();
    expect(html).toContain('aria-live="polite" aria-atomic="true">Worker 1: Waiting for you</div>');
  });

  it("draws decorative avatars hidden from assistive technology", () => {
    const html = render();
    expect(html).toMatch(/<svg aria-hidden="true" focusable="false"[^>]*class="office-avatar/);
  });

  it("groups a busy office into labelled rooms by role", () => {
    const roles = ["implementation", "implementation", "validation", "plan_review", null, "validation"];
    const busy: ConversationWorkerRecord[] = roles.map((workerRole, index) => ({
      id: `busy-${index}`,
      runId: "run-1",
      type: "codex",
      status: "working",
      workerNumber: index + 1,
      workerRole,
    }));
    const html = renderToStaticMarkup(<OfficeView workers={busy} agentsById={new Map()} onFocusWorker={() => undefined} />);
    const headings = [...html.matchAll(/<h4[^>]*>([^<]+)<\/h4>/g)].map((match) => match[1]);
    expect(headings).toEqual(["Main", "Implementation", "Validation", "Review"]);
    expect(html).toContain('<section class="space-y-1.5 rounded-lg border border-border/50 p-2" aria-label="Review">');
  });

  it("shows a single unlabelled room for a small office", () => {
    expect(render()).not.toContain("<h4");
  });
});
