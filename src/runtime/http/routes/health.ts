import type { OmniHttpHandler } from "@/runtime/http/registry";

export const handleHealthRequest: OmniHttpHandler = () => Response.json(
  { ok: true },
  {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    },
  },
);
