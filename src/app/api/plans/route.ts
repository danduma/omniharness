import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handlePlansRequest } from "@/runtime/http/routes/plans";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handlePlansRequest, { surface: "web" });
