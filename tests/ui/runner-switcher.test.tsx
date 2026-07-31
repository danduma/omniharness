import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  RunnerConnectionStatusPanel,
  RunnerSwitcherButton,
} from "@/interface/runners/RunnerSwitcher";

describe("runner switcher UI", () => {
  it("renders an accessible active server control without conversation counters", () => {
    const html = renderToStaticMarkup(
      <RunnerSwitcherButton
        runnerName="Studio"
        status="online"
        expanded={false}
      />,
    );

    expect(html).toContain('id="runner-switcher"');
    expect(html).toContain('aria-label="Switch server. Studio is Online."');
    expect(html).not.toContain('data-slot="badge"');
  });

  it("shows runner controls in the remote-only Electron shell", () => {
    expect(renderToStaticMarkup(
      <RunnerSwitcherButton
        runnerName="Local"
        status="online"
        expanded={false}
        surface="electron"
      />,
    )).toContain('id="runner-switcher"');
  });

  it("renders specific recovery actions for reauth, TLS, identity, incompatibility, and deferred states", () => {
    for (const [status, expected] of [
      ["needs-reauth", "Authorize again"],
      ["tls-untrusted", "Review certificate"],
      ["identity-mismatch", "Review identity"],
      ["incompatible", "Update required"],
      ["deferred", "Server is waiting"],
    ] as const) {
      const html = renderToStaticMarkup(
        <RunnerConnectionStatusPanel
          runnerName="Studio"
          status={status}
          onAction={() => {}}
        />,
      );
      expect(html).toContain(expected);
    }
  });
});
