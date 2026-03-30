import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { generateCallSheet, formatCallSheetText, generateMailtoLink } from "@/lib/services/call-sheet.service";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio", "Vendor"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const shootId = searchParams.get("shootId");
    const dateId = searchParams.get("dateId") || undefined;
    const format = searchParams.get("format") || "json";

    if (!campaignId || !shootId) {
      return NextResponse.json(
        { error: "campaignId and shootId are required" },
        { status: 400 }
      );
    }

    const data = await generateCallSheet(campaignId, shootId, dateId);

    if (format === "text") {
      return new Response(formatCallSheetText(data), {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (format === "mailto") {
      return NextResponse.json({ mailto: generateMailtoLink(data) });
    }

    return NextResponse.json(data);
  } catch (error) {
    return authErrorResponse(error);
  }
}
