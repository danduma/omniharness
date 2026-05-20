import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleAttachmentsRequest } from "@/runtime/http/routes/attachments";

export const GET = adaptOmniHandlerToNext(handleAttachmentsRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleAttachmentsRequest, { surface: "web" });
