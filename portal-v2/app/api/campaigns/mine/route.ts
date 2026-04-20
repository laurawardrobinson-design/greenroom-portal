import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { listCampaignsByPrimaryAssignee } from "@/lib/services/campaign-assignments.service";
import { getCampaign } from "@/lib/services/campaigns.service";
import type { Campaign } from "@/types/domain";

// GET /api/campaigns/mine
// Returns campaigns where the current user is primary_designer or
// primary_art_director. Used by Asset Studio's My Work tab.
export async function GET() {
  try {
    const user = await getAuthUser();

    const [asDesigner, asAd] = await Promise.all([
      listCampaignsByPrimaryAssignee(user.id, "primary_designer"),
      listCampaignsByPrimaryAssignee(user.id, "primary_art_director"),
    ]);

    const designerSet = new Set(asDesigner);
    const adSet = new Set(asAd);
    const allIds = Array.from(new Set([...asDesigner, ...asAd]));

    const campaigns = (
      await Promise.all(allIds.map((id) => getCampaign(id)))
    ).filter((c): c is Campaign => c !== null);

    const items = campaigns.map((c) => ({
      campaign: c,
      roles: [
        designerSet.has(c.id) ? "primary_designer" : null,
        adSet.has(c.id) ? "primary_art_director" : null,
      ].filter(Boolean) as string[],
    }));

    return NextResponse.json({ items });
  } catch (error) {
    return authErrorResponse(error);
  }
}
