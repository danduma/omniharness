import { NextRequest } from "next/server";
import { handleWorkerEntriesRequest } from "@/runtime/http/routes/worker-entries";
import { withOuterProbe } from "@/server/slow-probe";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workerId: string }> },
) {
  const { workerId } = await params;
  const url = new URL(req.url);
  const label = `GET /api/workers/${workerId}/entries${url.search}`;
  return withOuterProbe(label, () =>
    handleWorkerEntriesRequest(req, { surface: "web", params: { workerId } }),
  );
}
