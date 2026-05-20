import { NextRequest } from "next/server";
import { handlePlanningReviewRequest } from "@/runtime/http/routes/planning";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePlanningReviewRequest(req, { surface: "web", params: { id } });
}
