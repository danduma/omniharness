#!/usr/bin/env node
// Measure cold/warm response times for the local dev server.
// Assumes a dev server is already running on PORT (default 3035).
// Run: pnpm exec node scripts/measure-local-dev.mjs

const PORT = Number(process.env.PORT || 3035);
const BASE = `http://127.0.0.1:${PORT}`;

const ROUTES = [
  "/",
  "/api/auth/session",
  "/api/settings",
  "/api/agents/catalog",
  "/api/events?snapshot=1&persisted=1",
];

async function timeRequest(path) {
  const start = process.hrtime.bigint();
  let status = 0;
  let bytes = 0;
  let error = null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "GET",
      headers: { Accept: "text/html,application/json,*/*" },
    });
    status = res.status;
    const buf = await res.arrayBuffer();
    bytes = buf.byteLength;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
  return { path, status, bytes, elapsedMs, error };
}

function fmt(row) {
  const status = row.error ? `ERR(${row.error})` : `${row.status}`;
  return `${row.path.padEnd(40)} ${status.padEnd(10)} ${row.elapsedMs.toFixed(0).padStart(6)} ms  ${String(row.bytes).padStart(8)} B`;
}

async function main() {
  const date = new Date().toISOString();
  console.log(`# OmniHarness local-dev measurement`);
  console.log(`# date: ${date}`);
  console.log(`# base: ${BASE}`);
  console.log(`# node: ${process.version}  platform: ${process.platform} ${process.arch}`);
  console.log(``);

  console.log(`## cold (first hit per route)`);
  const cold = [];
  for (const route of ROUTES) {
    const r = await timeRequest(route);
    cold.push(r);
    console.log(fmt(r));
  }

  console.log(``);
  console.log(`## warm (3-sample best)`);
  for (const route of ROUTES) {
    const samples = [];
    for (let i = 0; i < 3; i += 1) {
      samples.push(await timeRequest(route));
    }
    const best = samples.reduce((a, b) => (a.elapsedMs < b.elapsedMs ? a : b));
    console.log(fmt(best));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
