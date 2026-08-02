import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineElicitation } from "@/components/agent-interactions/InlineElicitation";

describe("inline Claude interactions", () => {
  it("renders the exact hidden multi-select request in the conversation", () => {
    const html = renderToStaticMarkup(<InlineElicitation
      workerId="incident-worker"
      elicitation={{
        requestId: 2,
        requestedAt: "2026-07-11T11:57:17.558Z",
        sessionId: "incident-session",
        toolCallId: "incident-tool",
        message: "Do you have unfair access to any of these niches?",
        requestedSchema: {
          type: "object",
          properties: {
            question_0: {
              type: "array",
              title: "Niche access",
              items: {
                anyOf: [
                  { const: "Agencies / freelancer world", title: "Agencies / freelancer world" },
                  { const: "Legal / professional services", title: "Legal / professional services" },
                  { const: "Property / recruiting", title: "Property / recruiting" },
                  { const: "No special access", title: "No special access" },
                ],
              },
            },
            customAnswer: { type: "string", title: "Other" },
          },
        },
      }}
      onRespond={() => undefined}
    />);

    expect(html).toContain("Do you have unfair access");
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
    expect(html).toContain("Agencies / freelancer world");
    expect(html).toContain("No special access");
    expect(html).toContain("<textarea");
    expect(html).toContain(">Send<");
  });

  it("renders separate Claude questions as tabs instead of one long form", () => {
    const html = renderToStaticMarkup(<InlineElicitation
      workerId="tabbed-worker"
      elicitation={{
        requestId: 3,
        requestedAt: "2026-08-02T18:29:27.120Z",
        sessionId: "tabbed-session",
        toolCallId: "tabbed-tool",
        message: "Please answer the following questions.",
        requestedSchema: {
          type: "object",
          properties: {
            question_0: {
              type: "string",
              title: "Keyframe kind",
              oneOf: [
                { const: "Step", title: "Step" },
                { const: "Interpolated", title: "Interpolated" },
              ],
            },
            question_1: {
              type: "array",
              title: "Scope",
              items: {
                anyOf: [
                  { const: "Resize", title: "Resize" },
                  { const: "Drag", title: "Drag" },
                ],
              },
            },
            customAnswer: { type: "string", title: "Other" },
          },
        },
      }}
      onRespond={() => undefined}
    />);

    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('role="tab" aria-selected="true"');
    expect(html).toContain('role="tab" aria-selected="false"');
    expect(html).toContain("Keyframe kind");
    expect(html).toContain("Scope");
    expect(html).toContain("Step");
    expect(html).not.toContain('value="Resize"');
    expect(html).toContain("Other");
  });
});
