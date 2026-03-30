import { NextResponse } from "next/server";
import { requireRole, getAuthUser, requireCampaignAccess, authErrorResponse } from "@/lib/auth/guards";
import {
  listCampaignVendors,
  listVendorAssignments,
  assignVendorToCampaign,
} from "@/lib/services/campaign-vendors.service";

// GET /api/campaign-vendors?campaignId=xxx OR ?vendorId=xxx
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaignId");
    const vendorId = searchParams.get("vendorId");

    if (vendorId) {
      // Vendor fetching their own assignments across all campaigns
      if (user.role === "Vendor" && user.vendorId !== vendorId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const assignments = await listVendorAssignments(vendorId);
      return NextResponse.json(assignments);
    }

    if (!campaignId) {
      return NextResponse.json({ error: "campaignId or vendorId required" }, { status: 400 });
    }

    await requireCampaignAccess(user, campaignId);
    const vendors = await listCampaignVendors(campaignId);
    return NextResponse.json(vendors);
  } catch (error) {
    return authErrorResponse(error);
  }
}

// POST /api/campaign-vendors — assign vendor to campaign
export async function POST(request: Request) {
  try {
    await requireRole(["Admin", "Producer"]);
    const { campaignId, vendorId } = await request.json();

    if (!campaignId || !vendorId) {
      return NextResponse.json(
        { error: "campaignId and vendorId required" },
        { status: 400 }
      );
    }

    const cv = await assignVendorToCampaign(campaignId, vendorId);
    return NextResponse.json(cv, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return authErrorResponse(error);
  }
}
