import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getActiveCheckouts, getRecentActivity } from "@/lib/services/gear.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || undefined;
    const recent = searchParams.get("recent") === "true";

    if (recent) {
      const activity = await getRecentActivity(10);
      return NextResponse.json(activity);
    }

    const checkouts = await getActiveCheckouts(userId);
    return NextResponse.json(checkouts);
  } catch (error) {
    return authErrorResponse(error);
  }
}
