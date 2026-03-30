import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { listNotifications, markAllNotificationsRead } from "@/lib/services/notifications.service";

// GET /api/notifications — list current user's notifications
export async function GET() {
  try {
    const user = await getAuthUser();
    const notifications = await listNotifications(user.id);
    return NextResponse.json(notifications);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// PATCH /api/notifications — mark all as read
export async function PATCH() {
  try {
    const user = await getAuthUser();
    await markAllNotificationsRead(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
