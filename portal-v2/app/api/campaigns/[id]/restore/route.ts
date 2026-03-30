import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { restoreCampaign } from "@/lib/services/campaigns.service";

// POST /api/campaigns/[id]/restore — restore a soft-deleted campaign
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(["Admin"]);
    const { id } = await params;
    const campaign = await restoreCampaign(id);
    return NextResponse.json(campaign);
  } catch (error) {
    return authErrorResponse(error);
  }
}
