import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { authEvents, authSessions } from "@/server/db/schema";
import { createAuthSession } from "@/server/auth/session";
import { AUTH_SESSION_COOKIE } from "@/server/auth/config";
import {
  ensureRunnerIdentity,
  renameRunner,
} from "@/server/runner/identity";
import {
  __resetNamedEventsForTests,
  getEventCursor,
  getNamedEventsSince,
} from "@/server/events/named-events";
import {
  runnerRekeyRoute,
  runnerSettingsRoute,
  runtimeBootstrapRoute,
} from "@/../tests/helpers/runtime-routes";

function cookieRequest(url: string, method: string, token: string, body: unknown) {
  return new Request(url, {
    method,
    headers: {
      cookie: `${AUTH_SESSION_COOKIE}=${token}`,
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("runner administration routes", () => {
  beforeEach(async () => {
    process.env.OMNIHARNESS_AUTH_PASSWORD = "test-password";
    await db.delete(authEvents);
    await db.delete(authSessions);
    __resetNamedEventsForTests();
    await renameRunner("OmniHarness Runner");
  });

  it("renames the runner and propagates it through bootstrap with audit and named events", async () => {
    const session = await createAuthSession({
      authMethod: "password_login",
      label: "Admin",
    });
    const cursor = getEventCursor();
    const response = await runnerSettingsRoute(cookieRequest(
      "http://localhost/api/runner",
      "PATCH",
      session.tokenValue,
      { name: "Studio runner" },
    ));

    expect(response.status).toBe(200);
    const bootstrap = await runtimeBootstrapRoute(new Request("http://localhost/api/runtime/bootstrap"));
    await expect(bootstrap.json()).resolves.toEqual(expect.objectContaining({
      runner: expect.objectContaining({ name: "Studio runner" }),
    }));
    expect((await db.select().from(authEvents)).some((event) => event.eventType === "runner.renamed")).toBe(true);
    expect(getNamedEventsSince(cursor).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({ kind: "runner.renamed", name: "Studio runner" }),
    );
  });

  it("rekeys the runner and reports both old and new identities", async () => {
    const session = await createAuthSession({
      authMethod: "password_login",
      label: "Admin",
    });
    const before = await ensureRunnerIdentity();
    const cursor = getEventCursor();
    const response = await runnerRekeyRoute(cookieRequest(
      "http://localhost/api/runner/rekey",
      "POST",
      session.tokenValue,
      {},
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.previousRunnerInstanceId).toBe(before.runnerInstanceId);
    expect(body.runner.runnerInstanceId).not.toBe(before.runnerInstanceId);
    expect(getNamedEventsSince(cursor).events.map((entry) => entry.event)).toContainEqual(
      expect.objectContaining({
        kind: "runner.rekeyed",
        previousRunnerInstanceId: before.runnerInstanceId,
        runnerInstanceId: body.runner.runnerInstanceId,
      }),
    );
  });
});
