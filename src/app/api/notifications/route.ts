import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import {
  parseBrowserPushSubscription,
  revokeNotificationSubscription,
  saveNotificationSubscription,
} from "@/server/notifications/preferences";
import { getVapidPublicKey } from "@/server/notifications/web-push";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Notifications",
      action: "Load notification configuration",
    });
    if (auth.response) {
      return auth.response;
    }

    return NextResponse.json({
      supported: true,
      publicKey: await getVapidPublicKey(),
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Notifications",
      action: "Load notification configuration",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Notifications",
      action: "Save notification subscription",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json();
    const subscription = parseBrowserPushSubscription((body as { subscription?: unknown }).subscription);
    if (!subscription) {
      return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    }

    await saveNotificationSubscription({
      subscription,
      sessionId: auth.session?.id ?? null,
      userAgent: req.headers.get("user-agent"),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Notifications",
      action: "Save notification subscription",
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiSession(req, {
      source: "Notifications",
      action: "Remove notification subscription",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await req.json();
    const endpoint = typeof (body as { endpoint?: unknown }).endpoint === "string"
      ? (body as { endpoint: string }).endpoint
      : "";
    await revokeNotificationSubscription(endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Notifications",
      action: "Remove notification subscription",
    });
  }
}
