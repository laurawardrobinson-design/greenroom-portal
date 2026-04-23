import { NextResponse } from "next/server";
import { authErrorResponse, getAuthUser, requireCampaignVendorAccess } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/po/view/[id] — PO document view data for a campaign_vendor_id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    const { id } = await params;
    await requireCampaignVendorAccess(user, id);
    const db = createAdminClient();

    const { data: cv, error: cvError } = await db
      .from("campaign_vendors")
      .select(
        "*, vendors(*), campaigns(id, name, wf_number)"
      )
      .eq("id", id)
      .single();

    if (cvError || !cv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: estimateItems } = await db
      .from("vendor_estimate_items")
      .select("*")
      .eq("campaign_vendor_id", id)
      .order("sort_order", { ascending: true });

    return NextResponse.json({
      cv: {
        ...cv,
        po_authorized_by: cv.po_authorized_by ?? null,
        po_authorized_at: cv.po_authorized_at ?? null,
      },
      estimateItems: estimateItems || [],
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
