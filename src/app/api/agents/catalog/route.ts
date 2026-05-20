import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAgentsCatalogRequest } from "@/runtime/http/routes/agents-catalog";

export const GET = adaptOmniHandlerToNext(handleAgentsCatalogRequest, { surface: "web" });
