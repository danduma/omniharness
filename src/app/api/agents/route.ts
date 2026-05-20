import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAgentsRequest } from "@/runtime/http/routes/agents";

export const GET = adaptOmniHandlerToNext(handleAgentsRequest, { surface: "web" });
