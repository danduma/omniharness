import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MEMORY_BUDGETS = {
  development: {
    topology: "runner-vite-dev",
    maximumPeakRssMb: 2_048,
  },
  production: {
    topology: "production-runner",
    maximumPeakRssMb: 1_024,
  },
};

export function memoryBudgetForTopology(mode) {
  const budget = MEMORY_BUDGETS[mode];
  if (!budget) {
    throw new TypeError("Memory measurement mode must be development or production.");
  }
  return { ...budget };
}

export function assertMemoryBudget({ mode, peakRssMb }) {
  const budget = memoryBudgetForTopology(mode);
  if (!Number.isFinite(peakRssMb) || peakRssMb < 0) {
    throw new TypeError("peakRssMb must be a non-negative number.");
  }
  const result = {
    ...budget,
    peakRssMb,
    passed: peakRssMb < budget.maximumPeakRssMb,
  };
  if (!result.passed) {
    throw new Error(
      `${budget.topology} peak RSS ${peakRssMb} MiB exceeded the strict `
      + `${budget.maximumPeakRssMb} MiB cutover budget.`,
    );
  }
  return result;
}

export function parseProcessTable(output) {
  const processes = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (!match) {
      continue;
    }
    processes.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      rssKb: Number(match[3]),
      command: match[4],
    });
  }
  return processes;
}

export function collectProcessTree(processes, rootPid) {
  const byParent = new Map();
  for (const process of processes) {
    const children = byParent.get(process.ppid) ?? [];
    children.push(process);
    byParent.set(process.ppid, children);
  }

  const root = processes.find((process) => process.pid === rootPid);
  if (!root) {
    throw new Error(`Process ${rootPid} was not found while sampling memory.`);
  }

  const collected = [];
  const queue = [root];
  const seen = new Set();
  while (queue.length > 0) {
    const process = queue.shift();
    if (!process || seen.has(process.pid)) {
      continue;
    }
    seen.add(process.pid);
    collected.push(process);
    queue.push(...(byParent.get(process.pid) ?? []));
  }
  return collected;
}

function isManagedAgentRoot(command) {
  return /(?:^|[\/\s])(?:codex-acp|claude-agent-acp)(?:\s|$)/.test(command);
}

export function excludeAmbientAgentSubtrees(processes, {
  fixtureCommandIncludes,
}) {
  const byParent = new Map();
  for (const process of processes) {
    const children = byParent.get(process.ppid) ?? [];
    children.push(process);
    byParent.set(process.ppid, children);
  }

  const excludedPids = new Set();
  const queue = processes.filter((process) => (
    isManagedAgentRoot(process.command)
    && !process.command.includes(fixtureCommandIncludes)
  ));
  while (queue.length > 0) {
    const process = queue.shift();
    if (!process || excludedPids.has(process.pid)) {
      continue;
    }
    excludedPids.add(process.pid);
    queue.push(...(byParent.get(process.pid) ?? []));
  }

  return {
    included: processes.filter((process) => !excludedPids.has(process.pid)),
    excluded: processes.filter((process) => excludedPids.has(process.pid)),
  };
}

export async function readProcessTreeSample(rootPid, atMs = Date.now()) {
  const { stdout } = await execFileAsync("ps", [
    "-axo",
    "pid=,ppid=,rss=,command=",
  ], {
    maxBuffer: 16 * 1024 * 1024,
  });
  const processes = collectProcessTree(parseProcessTable(stdout), rootPid);
  return {
    atMs,
    rootPid,
    processCount: processes.length,
    rssKb: processes.reduce((total, process) => total + process.rssKb, 0),
    processes,
  };
}

export async function runMemorySampler({
  durationMs,
  intervalMs,
  readSample,
  sleep,
  now = Date.now,
}) {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new TypeError("durationMs must be a non-negative number.");
  }
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new TypeError("intervalMs must be a positive number.");
  }

  const sampleCount = Math.floor(durationMs / intervalMs) + 1;
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = await readSample(now());
    samples.push(sample);
    if (index < sampleCount - 1) {
      await sleep(intervalMs);
    }
  }

  return {
    samples,
    peakRssKb: Math.max(...samples.map((sample) => sample.rssKb)),
    finalRssKb: samples.at(-1)?.rssKb ?? 0,
  };
}

export async function runFixtureWorkload({
  durationMs,
  promptIntervalMs,
  agentName,
  projectRoot,
  fixtureCommand,
  fixtureArgs,
  request,
  sleep,
}) {
  const promptCount = Math.max(1, Math.floor(durationMs / promptIntervalMs));
  let spawned = false;
  try {
    await request("/agents", {
      method: "POST",
      body: {
        type: "custom",
        name: agentName,
        cwd: projectRoot,
        command: fixtureCommand,
        args: fixtureArgs,
      },
    });
    spawned = true;

    for (let index = 0; index < promptCount; index += 1) {
      await request(`/agents/${encodeURIComponent(agentName)}/ask`, {
        method: "POST",
        body: {
          prompt: `memory-fixture prompt ${index + 1} of ${promptCount}`,
        },
      });
      if (index < promptCount - 1) {
        await sleep(promptIntervalMs);
      }
    }
  } finally {
    if (spawned) {
      await request(`/agents/${encodeURIComponent(agentName)}`, {
        method: "DELETE",
      });
    }
  }
}
