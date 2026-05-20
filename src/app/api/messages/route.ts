import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleMessagesRequest } from "@/runtime/http/routes/messages";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handleMessagesRequest, { surface: "web" });
