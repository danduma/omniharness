#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertMemoryBudget,
  excludeAmbientAgentSubtrees,
  memoryBudgetForTopology,
  readProcessTreeSample,
  runFixtureWorkload,
  runMemorySampler,
} from "./lib/process-memory.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..");
const ROUTES = [
  "/",
  "/api/auth/session",
  "/api/settings",
  "/api/agents/catalog",
  "/api/events?snapshot=1&persisted=1",
];

function readPositiveNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new TypeError(`${label} must be a positive number.`);
  }
  return parsed;
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      throw new TypeError(`Unexpected argument: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new TypeError(`Missing value for ${argument}.`);
    }
    values.set(argument, value);
    index += 1;
  }

  const rootPid = readPositiveNumber(
    values.get("--pid") ?? process.env.OMNIHARNESS_MEASURE_ROOT_PID,
    "--pid",
  );
  const port = readPositiveNumber(
    values.get("--port") ?? process.env.OMNIHARNESS_RUNNER_PORT ?? process.env.PORT ?? "3050",
    "--port",
  );
  const mode = values.get("--mode") ?? "development";
  memoryBudgetForTopology(mode);
  return {
    mode,
    rootPid,
    baseUrl: values.get("--base-url") ?? `http://127.0.0.1:${port}`,
    runtimeUrl: values.get("--runtime-url") ?? "http://127.0.0.1:7800",
    durationMs: readPositiveNumber(
      values.get("--duration-ms") ?? "600000",
      "--duration-ms",
    ),
    sampleIntervalMs: readPositiveNumber(
      values.get("--sample-interval-ms") ?? "1000",
      "--sample-interval-ms",
    ),
    promptIntervalMs: readPositiveNumber(
      values.get("--prompt-interval-ms") ?? "5000",
      "--prompt-interval-ms",
    ),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timeRequest(baseUrl, route) {
  const start = process.hrtime.bigint();
  let status = 0;
  let bytes = 0;
  let error = null;
  try {
    const response = await fetch(`${baseUrl}${route}`, {
      method: "GET",
      headers: { accept: "text/html,application/json,*/*" },
    });
    status = response.status;
    bytes = (await response.arrayBuffer()).byteLength;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  return {
    route,
    status,
    bytes,
    elapsedMs: Number(process.hrtime.bigint() - start) / 1e6,
    error,
  };
}

async function measureRoutes(baseUrl) {
  const cold = [];
  const warm = [];
  for (const route of ROUTES) {
    cold.push(await timeRequest(baseUrl, route));
  }
  for (const route of ROUTES) {
    const samples = [];
    for (let index = 0; index < 3; index += 1) {
      samples.push(await timeRequest(baseUrl, route));
    }
    warm.push(samples.reduce((best, sample) => (
      sample.elapsedMs < best.elapsedMs ? sample : best
    )));
  }
  return { cold, warm };
}

function createRuntimeRequest(runtimeUrl) {
  return async (requestPath, init) => {
    const response = await fetch(`${runtimeUrl}${requestPath}`, {
      method: init.method,
      headers: init.body === undefined
        ? undefined
        : { "content-type": "application/json" },
      body: init.body === undefined
        ? undefined
        : JSON.stringify(init.body),
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Fixture runtime request ${init.method} ${requestPath} failed with HTTP ${response.status}: ${bodyText}`,
      );
    }
    return bodyText ? JSON.parse(bodyText) : null;
  };
}

function compactProcess(process) {
  const commandLimit = 160;
  return {
    pid: process.pid,
    ppid: process.ppid,
    rssMb: Number((process.rssKb / 1024).toFixed(1)),
    command: process.command.length > commandLimit
      ? `${process.command.slice(0, commandLimit - 1)}…`
      : process.command,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const measuredAt = new Date().toISOString();
  const latencyBefore = await measureRoutes(options.baseUrl);
  const agentName = `memory-fixture-${process.pid}`;
  const fixturePath = path.join(
    SCRIPT_DIR,
    "fixtures",
    "memory-benchmark-agent.mjs",
  );

  const [memory] = await Promise.all([
    runMemorySampler({
      durationMs: options.durationMs,
      intervalMs: options.sampleIntervalMs,
      readSample: async (atMs) => {
        const grossSample = await readProcessTreeSample(options.rootPid, atMs);
        const partition = excludeAmbientAgentSubtrees(grossSample.processes, {
          fixtureCommandIncludes: "scripts/fixtures/memory-benchmark-agent.mjs",
        });
        return {
          ...grossSample,
          grossRssKb: grossSample.rssKb,
          grossProcessCount: grossSample.processCount,
          excludedAmbientRssKb: partition.excluded.reduce(
            (total, process) => total + process.rssKb,
            0,
          ),
          excludedAmbientProcessCount: partition.excluded.length,
          processes: partition.included,
          processCount: partition.included.length,
          rssKb: partition.included.reduce(
            (total, process) => total + process.rssKb,
            0,
          ),
        };
      },
      sleep,
    }),
    runFixtureWorkload({
      durationMs: options.durationMs,
      promptIntervalMs: options.promptIntervalMs,
      agentName,
      projectRoot: REPOSITORY_ROOT,
      fixtureCommand: process.execPath,
      fixtureArgs: [fixturePath],
      request: createRuntimeRequest(options.runtimeUrl),
      sleep,
    }),
  ]);

  const latencyAfter = await measureRoutes(options.baseUrl);
  const peakSample = memory.samples.reduce((peak, sample) => (
    sample.rssKb > peak.rssKb ? sample : peak
  ));
  const finalSample = memory.samples.at(-1);
  const grossPeakSample = memory.samples.reduce((peak, sample) => (
    sample.grossRssKb > peak.grossRssKb ? sample : peak
  ));
  const peakRssMb = Number((memory.peakRssKb / 1024).toFixed(1));
  const budget = assertMemoryBudget({
    mode: options.mode,
    peakRssMb,
  });

  const report = {
    schemaVersion: 1,
    measuredAt,
    topology: budget.topology,
    platform: `${process.platform}-${process.arch}`,
    node: process.version,
    rootPid: options.rootPid,
    baseUrl: options.baseUrl,
    runtimeUrl: options.runtimeUrl,
    workload: {
      durationMs: options.durationMs,
      sampleIntervalMs: options.sampleIntervalMs,
      promptIntervalMs: options.promptIntervalMs,
      promptCount: Math.max(
        1,
        Math.floor(options.durationMs / options.promptIntervalMs),
      ),
      liveModel: false,
      fixture: path.relative(REPOSITORY_ROOT, fixturePath),
      ambientAgentPolicy: "exclude unrelated codex-acp and claude-agent-acp subtrees",
      repeatTolerancePercent: 15,
    },
    memory: {
      budget,
      sampleCount: memory.samples.length,
      peakRssMb,
      finalRssMb: Number((memory.finalRssKb / 1024).toFixed(1)),
      peakProcessCount: peakSample.processCount,
      finalProcessCount: finalSample?.processCount ?? 0,
      grossPeakRssMb: Number((grossPeakSample.grossRssKb / 1024).toFixed(1)),
      grossFinalRssMb: Number(((finalSample?.grossRssKb ?? 0) / 1024).toFixed(1)),
      peakExcludedAmbientRssMb: Number(
        (grossPeakSample.excludedAmbientRssKb / 1024).toFixed(1),
      ),
      finalExcludedAmbientRssMb: Number(
        ((finalSample?.excludedAmbientRssKb ?? 0) / 1024).toFixed(1),
      ),
      peakProcesses: peakSample.processes.map(compactProcess),
      finalProcesses: (finalSample?.processes ?? []).map(compactProcess),
    },
    latencyBefore,
    latencyAfter,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
