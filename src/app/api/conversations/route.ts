import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleConversationsRequest } from "@/runtime/http/routes/conversations";

export const POST = adaptOmniHandlerToNext(handleConversationsRequest, { surface: "web" });
