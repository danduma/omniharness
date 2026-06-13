import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleExternalSessionsRequest } from "@/runtime/http/routes/external-sessions";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handleExternalSessionsRequest, { surface: "web" });
