import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { getBrandMarketingPortfolio } from "@/lib/services/brand-marketing.service";

// GET /api/brand-marketing/portfolio?lob=Meat%20%26%20Seafood
//
// Returns the current BMM's owned campaigns split into the Home Page rails
// (in-flight + next 30 days in-market). Admin can hit this too but gets
// their own empty result unless they've been assigned brand_owner_id on
// something. A future story may add a ?ownerId param for Admin CMO views.
export async function GET(request: Request) {
  try {
    const user = await requireRole(["Admin", "Brand Marketing Manager"]);
    const { searchParams } = new URL(request.url);
    const lob = searchParams.get("lob") || undefined;

    const portfolio = await getBrandMarketingPortfolio(user.id, { lob });
    return NextResponse.json(portfolio);
  } catch (error) {
    return authErrorResponse(error);
  }
}
