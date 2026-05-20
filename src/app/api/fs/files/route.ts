import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleProjectFilesRequest } from "@/runtime/http/routes/filesystem";

export const GET = adaptOmniHandlerToNext(handleProjectFilesRequest, { surface: "web" });
