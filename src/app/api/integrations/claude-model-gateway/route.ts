import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleClaudeModelGatewayRequest } from "@/runtime/http/routes/claude-model-gateway";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handleClaudeModelGatewayRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleClaudeModelGatewayRequest, { surface: "web" });
