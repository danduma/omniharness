import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleSupervisorRequest } from "@/runtime/http/routes/supervisor";

export const POST = adaptOmniHandlerToNext(handleSupervisorRequest, { surface: "web" });
