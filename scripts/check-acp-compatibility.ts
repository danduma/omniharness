import * as acp from "@agentclientprotocol/sdk";
import {
  AGENT_TO_CLIENT_METHODS,
  CLIENT_TO_AGENT_METHODS,
} from "../src/server/agent-runtime/acp/capability-registry";

function assertExact(label: string, actual: readonly string[], expected: readonly string[]) {
  const left = [...new Set(actual)].sort();
  const right = [...new Set(expected)].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    throw new Error(`${label} registry mismatch: ${JSON.stringify({ actual: left, expected: right })}`);
  }
}

assertExact("agent-to-client", [...AGENT_TO_CLIENT_METHODS.keys()], Object.values(acp.CLIENT_METHODS));
assertExact("client-to-agent", [...CLIENT_TO_AGENT_METHODS.keys()], Object.values(acp.AGENT_METHODS));

const disabled = [...AGENT_TO_CLIENT_METHODS, ...CLIENT_TO_AGENT_METHODS]
  .filter(([, capability]) => capability.status !== "operational")
  .map(([method]) => method);
if (disabled.length > 0) throw new Error(`ACP methods are not operational: ${disabled.join(", ")}`);

process.stdout.write(`ACP ${acp.PROTOCOL_VERSION} compatibility registry covers ${AGENT_TO_CLIENT_METHODS.size + CLIENT_TO_AGENT_METHODS.size} methods.\n`);
