import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listCampaignProducts, linkProductToCampaign, unlinkProductFromCampaign } from "@/lib/services/products.service";
import { linkProductToCampaignSchema } from "@/lib/validation/products.schema";

export async function GET(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio", "Vendor"]);
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }
    const products = await listCampaignProducts(campaignId);
    return NextResponse.json(products);
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer", "Art Director", "Studio"]);
    const body = await request.json();
    const parsed = linkProductToCampaignSchema.parse(body);
    const link = await linkProductToCampaign(
      parsed.campaignId,
      parsed.productId,
      parsed.notes,
      parsed.sortOrder
    );
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
    await requireRole(["Admin", "Producer"]);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    await unlinkProductFromCampaign(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
