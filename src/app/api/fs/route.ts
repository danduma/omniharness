import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleBrowseFilesystemRequest } from "@/runtime/http/routes/filesystem";

export const GET = adaptOmniHandlerToNext(handleBrowseFilesystemRequest, { surface: "web" });
