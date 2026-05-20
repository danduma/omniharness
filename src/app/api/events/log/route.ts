import { adaptOmniHandlerToNext } from "@/runtime/http/adapters/next";
import { handleEventsLogRequest } from "@/runtime/http/routes/events-log";

export const dynamic = "force-dynamic";

export const GET = adaptOmniHandlerToNext(handleEventsLogRequest, { surface: "web" });
