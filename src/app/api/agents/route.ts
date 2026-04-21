import { NextResponse } from "next/server";
import { BRIDGE_URL, normalizeAgentRecord } from "@/server/bridge-client";

export async function GET() {
  try {
    const res = await fetch(`${BRIDGE_URL}/agents`);
    if (!res.ok) {
      return NextResponse.json({ error: res.statusText }, { status: res.status });
    }
    const data = await res.json();
    const normalized = Array.isArray(data) ? data.map((agent) => normalizeAgentRecord(agent)) : [];
    return NextResponse.json(normalized);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
