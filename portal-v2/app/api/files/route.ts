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

    // Validate file type — only allow known safe MIME types
    const ALLOWED_TYPES = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "video/mp4",
      "video/quicktime",
      "text/csv",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/msword",
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Enforce 50MB size limit server-side
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // Vendor upload restrictions
    if (user.role === "Vendor") {
      const allowed: AssetCategory[] = ["Deliverable", "Invoice", "Estimate"];
      if (!allowed.includes(category)) {
        return NextResponse.json(
          { error: "Vendors can only upload Deliverables, Estimates, and Invoices" },
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
