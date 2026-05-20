import { NextRequest } from "next/server";
import { handleWorkerEntriesRequest } from "@/runtime/http/routes/worker-entries";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> },
) {
  const { workerId } = await params;
  return handleWorkerEntriesRequest(req, { surface: "web", params: { workerId } });
}
