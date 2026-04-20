import { NextRequest, NextResponse } from "next/server";
import { BRIDGE_URL } from "@/server/bridge-client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const res = await fetch(`${BRIDGE_URL}/agents/${name}`);
    if (!res.ok) {
      return NextResponse.json({ error: res.statusText }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
