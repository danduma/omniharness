import fs from "node:fs";
import { Socket } from "node:net";
import path from "node:path";
import { expect, test } from "vitest";
import {
  attachUpgradeSocketErrorHandlers,
  isExpectedProxySocketError,
} from "@/../scripts/dev-compression-proxy";
import {
  isDevServerReadyLine,
  prewarmDevPaths,
  resolveDevPrewarmBaseUrl,
  resolveDevPrewarmPaths,
} from "@/../scripts/dev-prewarm";
import { describeUnexpectedDevExit } from "@/../scripts/dev-web-recovery";

const packageJson = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf8"),
) as { scripts?: Record<string, string> };

test("development starts the runner and Vite interface", () => {
  const devSource = fs.readFileSync(path.resolve(process.cwd(), "scripts/dev.ts"), "utf8");
  expect(packageJson.scripts?.dev).toBe("pnpm exec tsx scripts/dev.ts");
  expect(packageJson.scripts?.runner).toContain("scripts/runner.ts");
  expect(packageJson.scripts?.["dev:interface"]).toContain("vite");
  expect(packageJson.scripts).not.toHaveProperty("dev:web");
  expect(packageJson.scripts).not.toHaveProperty("dev:proxy");
  expect(devSource).toContain('["run", "runner", "--no-static"]');
  expect(devSource).not.toContain('["run", "runner", "--", "--no-static"]');
});

test("development child exits have a stable diagnostic", () => {
  expect(describeUnexpectedDevExit({
    label: "runner",
    code: 1,
    signal: null,
  })).toBe("runner exited with code 1.");
});

test("dev prewarm defaults include the live events snapshot route", () => {
  expect(resolveDevPrewarmPaths({})).toContain("/api/events?snapshot=1&persisted=1");
});

test("dev prewarm can be disabled or extended from env", () => {
  expect(resolveDevPrewarmPaths({ OMNIHARNESS_DEV_PREWARM: "0" })).toEqual([]);
  expect(resolveDevPrewarmPaths({
    OMNIHARNESS_DEV_PREWARM_PATHS: "/custom, api/custom-two",
    OMNIHARNESS_DEV_PREWARM_EXTRA_PATHS: "/api/events?snapshot=1",
  })).toEqual([
    "/custom",
    "/api/custom-two",
    "/api/events?snapshot=1",
  ]);
});

test("dev prewarm detects both Vite and runner ready lines", () => {
  expect(isDevServerReadyLine("  VITE v7 ready in 218 ms")).toBe(true);
  expect(isDevServerReadyLine('{"event":"runner.ready"}')).toBe(true);
  expect(isDevServerReadyLine("transforming modules")).toBe(false);
});

test("dev prewarm resolves wildcard hosts to localhost", () => {
  expect(resolveDevPrewarmBaseUrl("0.0.0.0", "3050")).toBe("http://127.0.0.1:3050");
  expect(resolveDevPrewarmBaseUrl("localhost", "3050")).toBe("http://localhost:3050");
});

test("dev prewarm requests routes sequentially", async () => {
  const activeRequests: string[] = [];
  const seen: string[] = [];
  const results = await prewarmDevPaths({
    baseUrl: "http://127.0.0.1:3050",
    paths: ["/one", "/two"],
    timeoutMs: 1000,
    fetchImpl: async (input) => {
      const requestPath = new URL(String(input)).pathname;
      expect(activeRequests).toEqual([]);
      activeRequests.push(requestPath);
      seen.push(requestPath);
      await new Promise((resolve) => setTimeout(resolve, 1));
      activeRequests.pop();
      return new Response("ok", { status: 200 });
    },
  });

  expect(seen).toEqual(["/one", "/two"]);
  expect(results.map((result) => result.status)).toEqual([200, 200]);
});

test("the retained compression harness treats disconnects as expected", () => {
  expect(isExpectedProxySocketError(Object.assign(new Error("write EPIPE"), { code: "EPIPE" }))).toBe(true);
  expect(isExpectedProxySocketError(Object.assign(new Error("socket hang up"), { code: "ECONNRESET" }))).toBe(true);
  expect(isExpectedProxySocketError(Object.assign(new Error("boom"), { code: "EINVAL" }))).toBe(false);
});

test("the retained compression harness handles EPIPE without an unhandled error", () => {
  const clientSocket = new Socket();
  const proxySocket = new Socket();
  const unhandled: unknown[] = [];
  const onUncaught = (error: unknown) => {
    unhandled.push(error);
  };

  process.once("uncaughtException", onUncaught);
  attachUpgradeSocketErrorHandlers(clientSocket, proxySocket);
  proxySocket.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
  process.removeListener("uncaughtException", onUncaught);

  expect(unhandled).toEqual([]);
  expect(clientSocket.destroyed).toBe(true);
  expect(proxySocket.destroyed).toBe(true);
});
