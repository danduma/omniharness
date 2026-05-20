import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import {
  parseBrowserPushSubscription,
  revokeNotificationSubscription,
  saveNotificationSubscription,
} from "@/server/notifications/preferences";
import { getVapidPublicKey } from "@/server/notifications/web-push";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

async function getNotifications(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Notifications",
    action: "Load notification configuration",
  });
  if (auth.response) {
    return auth.response;
  }

  return Response.json({
    supported: true,
    publicKey: await getVapidPublicKey(),
  });
}

async function postNotifications(request: Request) {
  const nextRequest = toNextRequest(request);
  const auth = await requireApiSession(nextRequest, {
    source: "Notifications",
    action: "Save notification subscription",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  const subscription = parseBrowserPushSubscription((body as { subscription?: unknown }).subscription);
  if (!subscription) {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  await saveNotificationSubscription({
    subscription,
    sessionId: auth.session?.id ?? null,
    userAgent: nextRequest.headers.get("user-agent"),
  });

  return Response.json({ ok: true });
}

async function deleteNotifications(request: Request) {
  const auth = await requireApiSession(toNextRequest(request), {
    source: "Notifications",
    action: "Remove notification subscription",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json();
  const endpoint = typeof (body as { endpoint?: unknown }).endpoint === "string"
    ? (body as { endpoint: string }).endpoint
    : "";
  await revokeNotificationSubscription(endpoint);

  return Response.json({ ok: true });
}

export const handleNotificationsRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") {
      return getNotifications(request);
    }
    if (request.method === "POST") {
      return postNotifications(request);
    }
    if (request.method === "DELETE") {
      return deleteNotifications(request);
    }
    return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, POST, DELETE" },
    });
  } catch (error) {
    const action = request.method === "POST"
      ? "Save notification subscription"
      : request.method === "DELETE"
        ? "Remove notification subscription"
        : "Load notification configuration";
    return errorResponse(error, {
      status: 500,
      source: "Notifications",
      action,
    });
  }
};
