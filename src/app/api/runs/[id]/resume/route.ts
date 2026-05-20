import { NextRequest } from "next/server";
import { handleRunResumeRequest } from "@/runtime/http/routes/run-resume";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRunResumeRequest(req, { surface: "web", params: { id } });
}
