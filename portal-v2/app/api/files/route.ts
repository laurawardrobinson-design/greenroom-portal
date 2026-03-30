import { NextResponse } from "next/server";
import { getAuthUser, requireCampaignAccess, authErrorResponse } from "@/lib/auth/guards";
import { listCampaignAssets, uploadCampaignAsset } from "@/lib/services/files.service";
import type { AssetCategory } from "@/types/domain";

// GET /api/files?campaignId=xxx&type=fun|boring
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const type = searchParams.get("type") as "fun" | "boring" | null;

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId required" }, { status: 400 });
    }

    await requireCampaignAccess(user, campaignId);
    const assets = await listCampaignAssets(campaignId, type || undefined);
    return NextResponse.json(assets);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/files — upload a file
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const campaignId = formData.get("campaignId") as string;
    const category = formData.get("category") as AssetCategory;

    if (!file || !campaignId || !category) {
      return NextResponse.json(
        { error: "file, campaignId, and category are required" },
        { status: 400 }
      );
    }

    // Vendor upload restrictions
    if (user.role === "Vendor") {
      const allowed: AssetCategory[] = ["Deliverable", "Invoice"];
      if (!allowed.includes(category)) {
        return NextResponse.json(
          { error: "Vendors can only upload Deliverables and Invoices" },
          { status: 403 }
        );
      }
    }

    await requireCampaignAccess(user, campaignId);

    const buffer = await file.arrayBuffer();
    const asset = await uploadCampaignAsset({
      campaignId,
      uploadedBy: user.id,
      vendorId: user.vendorId || undefined,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      category,
      fileBuffer: buffer,
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return authErrorResponse(error);
  }
}
