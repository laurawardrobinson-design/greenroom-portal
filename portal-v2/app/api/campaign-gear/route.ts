import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listCampaignGear, linkGearToCampaign, unlinkGearFromCampaign } from "@/lib/services/products.service";
import { linkGearToCampaignSchema } from "@/lib/validation/products.schema";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }
    const gear = await listCampaignGear(campaignId);
    return NextResponse.json(gear);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const body = await request.json();
    const parsed = linkGearToCampaignSchema.parse(body);
    const link = await linkGearToCampaign(parsed.campaignId, parsed.gearItemId, parsed.notes);
    return NextResponse.json(link, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Post Producer", "Studio"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await unlinkGearFromCampaign(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
