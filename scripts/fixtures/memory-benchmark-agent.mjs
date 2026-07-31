#!/usr/bin/env node
import readline from "node:readline";

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

let promptCount = 0;

function write(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

for await (const line of input) {
  if (!line.trim()) {
    continue;
  }

  const message = JSON.parse(line);
  if (message.method === "initialize") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: 1,
      },
    });
    continue;
  }

  if (message.method === "session/new") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        sessionId: "memory-benchmark-session",
      },
    });
    continue;
  }

  if (message.method === "session/set_mode" || message.method === "session/resume") {
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {},
    });
    continue;
  }

  if (message.method === "session/prompt") {
    promptCount += 1;
    const toolCallId = `memory-tool-${promptCount}`;
    write({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: message.params.sessionId,
        update: {
          sessionUpdate: "tool_call",
          toolCallId,
          kind: "execute",
          status: "in_progress",
          title: "Deterministic memory benchmark",
          rawInput: {
            command: `fixture-step-${promptCount}`,
          },
        },
      },
    });
    write({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: message.params.sessionId,
        update: {
          sessionUpdate: "tool_call_update",
          toolCallId,
          status: "completed",
          rawOutput: {
            formatted_output: `fixture step ${promptCount} completed\n`,
          },
        },
      },
    });
    write({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: message.params.sessionId,
        update: {
          sessionUpdate: "agent_message_chunk",
          content: {
            type: "text",
            text: `deterministic response ${promptCount}`,
          },
        },
      },
    });
    write({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        stopReason: "end_turn",
        usage: {
          inputTokens: 100 + promptCount,
          outputTokens: 50,
          totalTokens: 150 + promptCount,
        },
      },
    });
  }
}
