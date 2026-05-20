import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleProjectMemoryRequest } from "@/runtime/http/routes/project-memory";

export const GET = adaptOmniHandlerToNext(handleProjectMemoryRequest, { surface: "web" });
export const POST = adaptOmniHandlerToNext(handleProjectMemoryRequest, { surface: "web" });
