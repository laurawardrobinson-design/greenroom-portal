import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetRequests } from "@/lib/services/budget.service";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/approvals — pending + resolved items for HOP
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    // All budget requests (pending + resolved)
    const allRequests = await listBudgetRequests();
    const budgetRequests = allRequests.filter((r) => r.status === "Pending");
    const resolvedRequests = allRequests.filter((r) => r.status !== "Pending");

    // Pending invoice approvals (Invoice Pre-Approved → needs HOP approval)
    const { data: pendingInvoices } = await db
      .from("campaign_vendors")
      .select("*, vendors(company_name), campaigns(name, wf_number)")
      .eq("status", "Invoice Pre-Approved")
      .order("updated_at", { ascending: false });

    // Resolved invoice approvals (Invoice Approved or Paid)
    const { data: completedInvoices } = await db
      .from("campaign_vendors")
      .select("*, vendors(company_name), campaigns(name, wf_number)")
      .in("status", ["Invoice Approved", "Paid"])
      .order("updated_at", { ascending: false })
      .limit(50);

    function mapInvoice(row: any) {
      return {
        id: row.id,
        campaignId: row.campaign_id,
        vendorName: row.vendors?.company_name || "Unknown",
        campaignName: row.campaigns?.name || "Unknown",
        wfNumber: row.campaigns?.wf_number || "",
        estimateTotal: Number(row.estimate_total),
        invoiceTotal: Number(row.invoice_total),
        status: row.status,
        updatedAt: row.updated_at,
      };
    }

    return NextResponse.json({
      budgetRequests,
      pendingInvoices: (pendingInvoices || []).map(mapInvoice),
      resolvedRequests,
      resolvedInvoices: (completedInvoices || []).map(mapInvoice),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
