import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.join(process.cwd(), "scripts", "remote-restart.ts"),
  "utf8",
);

function restartCurrentHandler() {
  const start = source.indexOf('url.pathname === "/restart-current"');
  const end = source.indexOf('url.pathname === "/start"', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

// The handler lives in a script with a listening server at module scope, so it
// cannot be imported and driven directly. These assertions guard the one thing
// that silently broke before: the JSON reply used to be written only after the
// restart finished, by which point the runner that asked for it had been killed
// and the browser saw a failure for a restart that worked.
describe("remote-restart /restart-current ordering", () => {
  it("acknowledges the runner before stopping anything", () => {
    const handler = restartCurrentHandler();

    expect(handler).toContain("restartCurrentWithEarlyAck({");
    expect(handler).toContain("acknowledge: () => sendJson(response, 202,");
    expect(source).toContain("restartCurrentWithEarlyAck,");
  });

  it("never sends the JSON reply from inside the restart's continuation", () => {
    const handler = restartCurrentHandler();
    const continuations = handler.split(".then((entry) => {").slice(1);

    // The HTML branch may still wait for the outcome — that browser outlives the
    // restart. Only a JSON reply parked in a continuation is the old bug.
    for (const continuation of continuations) {
      const body = continuation.slice(0, continuation.indexOf("})"));
      expect(body).not.toContain("sendJson(response, 202");
    }
  });

  it("still reports a post-acknowledgement failure somewhere an operator sees it", () => {
    expect(restartCurrentHandler()).toContain("onFailure:");
  });
});
