import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handlePrewarmWorkerRequest } from "@/runtime/http/routes/prewarm-worker";

export const POST = adaptOmniHandlerToNext(handlePrewarmWorkerRequest, { surface: "web" });
