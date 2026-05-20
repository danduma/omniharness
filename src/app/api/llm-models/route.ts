import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleLlmModelsRequest } from "@/runtime/http/routes/llm-models";

export const POST = adaptOmniHandlerToNext(handleLlmModelsRequest, { surface: "web" });
