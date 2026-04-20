import fs from 'fs';
import path from 'path';
import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { Supervisor } from './src/server/supervisor';
import { db } from './src/server/db';
import { plans, runs, messages as dbMessages } from './src/server/db/schema';
import { randomUUID } from 'crypto';
import { BRIDGE_URL } from './src/server/bridge-client';

const planPath = process.argv[2];
if (!planPath) {
  console.error('Usage: pnpm exec tsx omni-cli.ts <plan-path>');
  process.exit(1);
}

async function start() {
  const absolutePath = path.resolve(process.cwd(), planPath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`Plan file not found: ${absolutePath}`);
    process.exit(1);
  }

  // Check if bridge is running
  try {
    const res = await fetch(`${BRIDGE_URL}/agents`);
    if (!res.ok) throw new Error('Bridge not responding');
  } catch (err) {
    console.error(`Error: acp-bridge is not running at ${BRIDGE_URL}.`);
    console.error(`Please start it first (e.g., in a sibling directory: cd ../acp-bridge && pnpm run daemon)`);
    process.exit(1);
  }

  const planId = randomUUID();
  await db.insert(plans).values({
    id: planId,
    path: planPath,
    status: 'running',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const runId = randomUUID();
  await db.insert(runs).values({
    id: runId,
    planId,
    status: 'running',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db.insert(dbMessages).values({
    id: randomUUID(),
    runId,
    role: 'user',
    content: `implement ${planPath}`,
    createdAt: new Date(),
  });

  // Initialize TUI
  const screen = blessed.screen({
    smartCSR: true,
    title: 'OmniHarness CLI',
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  const log = grid.set(8, 0, 4, 12, contrib.log, {
    fg: "green",
    selectedFg: "green",
    label: 'Supervisor Log'
  });

  const agentList = grid.set(0, 0, 8, 3, blessed.list, {
    label: 'Agents',
    keys: true,
    vi: true,
    style: {
      selected: {
        bg: 'blue'
      }
    }
  });

  const terminal = grid.set(0, 3, 8, 9, blessed.box, {
    label: 'Agent Output',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    border: { type: 'line' },
    style: {
      border: { fg: '#f0f0f0' }
    }
  });

  screen.key(['escape', 'q', 'C-c'], () => {
    return process.exit(0);
  });

  let agents: any[] = [];
  let selectedAgentName: string | null = null;
  let lastMessageCount = 0;
  const agentOutputs: Record<string, string> = {};

  agentList.on('select', (item: any) => {
    selectedAgentName = item.content;
    updateTerminal();
  });

  function updateTerminal() {
    if (selectedAgentName && agentOutputs[selectedAgentName]) {
      terminal.setContent(agentOutputs[selectedAgentName]);
      terminal.setScrollPerc(100);
    } else {
      terminal.setContent('Select an agent or waiting for output...');
    }
    screen.render();
  }

  async function poll() {
    try {
      // 1. Fetch messages for the log from DB
      const runMessages = await db.select().from(dbMessages).where(eq(dbMessages.runId, runId)).orderBy(dbMessages.createdAt);
      if (runMessages.length > lastMessageCount) {
        for (let i = lastMessageCount; i < runMessages.length; i++) {
          const m = runMessages[i];
          log.log(`[${m.role}] ${m.content}`);
        }
        lastMessageCount = runMessages.length;
      }

      // Check run status
      const currentRun = await db.select().from(runs).where(eq(runs.id, runId)).get();
      if (currentRun && currentRun.status === 'done') {
        log.log('PLAN COMPLETED SUCCESSFULLY.');
      }

      // 2. Fetch agents from bridge
      const agentRes = await fetch(`${BRIDGE_URL}/agents`);
      if (agentRes.ok) {
        const currentAgents = await agentRes.json();
        agents = currentAgents;
        
        const names = agents.map(a => a.name);
        const currentItems = agentList.getItemIndex(agentList.selected);
        agentList.setItems(names);
        if (currentItems !== -1) agentList.select(currentItems);
        
        if (!selectedAgentName && names.length > 0) {
          selectedAgentName = names[0];
          agentList.select(0);
        }

        // 3. Fetch specific agent outputs
        for (const agent of agents) {
           const res = await fetch(`${BRIDGE_URL}/agents/${agent.name}`);
           if (res.ok) {
              const data = await res.json();
              agentOutputs[agent.name] = data.currentText || data.lastText || "";
           }
        }
        
        updateTerminal();
      }
    } catch (err) {
      // log.log(`Error polling: ${err}`);
    }
    screen.render();
  }

  // We need to import 'eq' for the query
  const { eq } = await import('drizzle-orm');

  const supervisor = new Supervisor({ planId, runId });
  supervisor.run().catch((err) => {
    log.log(`Supervisor ERROR: ${err.message}`);
  });

  setInterval(poll, 1000);
  poll();
  screen.render();
}

start();
