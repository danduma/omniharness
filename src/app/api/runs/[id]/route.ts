import { NextRequest } from "next/server";
import {
  handleRunDeleteRequest,
  handleRunPatchRequest,
  handleRunPostRequest,
} from "@/runtime/http/routes/runs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRunPatchRequest(req, { surface: "web", params: { id } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRunPostRequest(req, { surface: "web", params: { id } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handleRunDeleteRequest(req, { surface: "web", params: { id } });
}
