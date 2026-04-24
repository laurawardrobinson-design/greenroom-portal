import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getOrCreateDraftByShootDate } from "@/lib/services/call-sheet.service";

export async function GET(request: Request) {
  try {
    await requireRole([
      "Admin",
      "Producer",
      "Post Producer",
      "Art Director",
      "Studio",
      "Creative Director",
      "Designer",
      "Brand Marketing Manager",
    ]);

    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const shootDateId = searchParams.get("shootDateId");

    if (!campaignId || !shootDateId) {
      return NextResponse.json(
        { error: "campaignId and shootDateId are required" },
        { status: 400 }
      );
    }

    const sheet = await getOrCreateDraftByShootDate(campaignId, shootDateId);
    return NextResponse.json(sheet);
  } catch (error) {
    return authErrorResponse(error);
  }
}
