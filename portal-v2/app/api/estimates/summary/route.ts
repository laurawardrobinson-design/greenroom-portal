import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/estimates/summary
// Returns all campaign-vendors that have an estimate on file, across all active campaigns.
// Includes a campaigns list for the filter dropdown.
// Scoped to Producer + Admin only.
export async function GET() {
  try {
    const user = await getAuthUser();
    const db = createAdminClient();

    if (user.role !== "Producer" && user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // All active campaigns
    const { data: campaigns } = await db
      .from("campaigns")
      .select("id, name, wf_number")
      .neq("status", "Complete")
      .neq("status", "Cancelled")
      .order("name");

    const campaignIds = (campaigns || []).map((c: any) => c.id as string);

    if (campaignIds.length === 0) {
      return NextResponse.json({ items: [], campaigns: [] });
    }

    // All vendors that have submitted (or moved past) an estimate
    const { data: rows } = await db
      .from("campaign_vendors")
      .select(
        "id, campaign_id, status, estimate_total, invoice_total, updated_at, vendors(company_name), campaigns(name, wf_number)"
      )
      .in("campaign_id", campaignIds)
      .not("status", "eq", "Invited")
      .not("status", "eq", "Paid")
      .not("estimate_total", "is", null)
      .order("updated_at", { ascending: false });

    const items = (rows || []).map((row: any) => ({
      id: row.id as string,
      campaignId: row.campaign_id as string,
      campaignName: (row.campaigns as any)?.name || "Unknown Campaign",
      wfNumber: (row.campaigns as any)?.wf_number || "",
      vendorName: (row.vendors as any)?.company_name || "Unknown Vendor",
      status: row.status as string,
      estimateTotal: Number(row.estimate_total || 0),
      invoiceTotal: row.invoice_total != null ? Number(row.invoice_total) : null,
      updatedAt: row.updated_at as string,
    }));

    return NextResponse.json({
      items,
      campaigns: (campaigns || []).map((c: any) => ({
        id: c.id as string,
        name: c.name as string,
        wfNumber: c.wf_number as string,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
