import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { suggestMealFromCrew } from "@/lib/services/studio.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const shootDate = searchParams.get("shootDate");
    if (!campaignId || !shootDate) {
      return NextResponse.json(
        { error: "campaignId and shootDate are required" },
        { status: 400 }
      );
    }
    const suggestion = await suggestMealFromCrew(campaignId, shootDate);
    return NextResponse.json(suggestion);
  } catch (error) {
    return authErrorResponse(error);
  }
}
