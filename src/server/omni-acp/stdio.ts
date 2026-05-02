import { Readable, Writable } from "stream";
import * as acp from "@agentclientprotocol/sdk";
import { OmniHarnessAcpAgent } from "./agent";

export function startOmniHarnessAcpStdio() {
  const stream = acp.ndJsonStream(
    Writable.toWeb(process.stdout),
    Readable.toWeb(process.stdin) as ReadableStream<Uint8Array>,
  );
  return new acp.AgentSideConnection((connection) => new OmniHarnessAcpAgent(connection), stream);
}
