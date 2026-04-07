import { NextResponse } from "next/server";
import { getAuthUser, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/invoices/pending
// Returns Invoice Submitted vendors (pending producer pre-approval) + invoice history
// Scoped to the current user's campaigns (or all campaigns for Admin)
export async function GET() {
  try {
    const user = await getAuthUser();
    const db = createAdminClient();

    if (user.role !== "Producer" && user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get all active campaign IDs — producers see all campaigns, not just their own,
    // since invoice review is a shared responsibility across the production team.
    const { data: campaigns } = await db
      .from("campaigns")
      .select("id")
      .neq("status", "Complete")
      .neq("status", "Cancelled");
    const campaignIds = (campaigns || []).map((c: any) => c.id as string);

    if (campaignIds.length === 0) {
      return NextResponse.json({ items: [], history: [] });
    }

    const [{ data: pending }, { data: history }] = await Promise.all([
      // Pending: Invoice Submitted — needs producer pre-approval
      db
        .from("campaign_vendors")
        .select("id, campaign_id, estimate_total, invoice_total, updated_at, vendors(company_name), campaigns(name, wf_number)")
        .eq("status", "Invoice Submitted")
        .in("campaign_id", campaignIds)
        .order("updated_at", { ascending: false }),

      // History: past the producer stage
      db
        .from("campaign_vendors")
        .select("id, status, campaign_id, estimate_total, invoice_total, updated_at, vendors(company_name), campaigns(name, wf_number)")
        .in("status", ["Invoice Pre-Approved", "Invoice Approved", "Paid"])
        .in("campaign_id", campaignIds)
        .order("updated_at", { ascending: false })
        .limit(25),
    ]);

    function mapRow(row: any) {
      return {
        id: row.id as string,
        campaignId: row.campaign_id as string,
        campaignName: (row.campaigns as any)?.name || "Unknown Campaign",
        wfNumber: (row.campaigns as any)?.wf_number || "",
        vendorName: (row.vendors as any)?.company_name || "Unknown Vendor",
        estimateTotal: Number(row.estimate_total || 0),
        invoiceTotal: Number(row.invoice_total || 0),
        updatedAt: row.updated_at as string,
      };
    }

    return NextResponse.json({
      items: (pending || []).map(mapRow),
      history: (history || []).map((row) => ({ ...mapRow(row), status: row.status as string })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
