import { NextRequest } from "next/server";
import { handlePlanningPromoteRequest } from "@/runtime/http/routes/planning";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePlanningPromoteRequest(req, { surface: "web", params: { id } });
}
