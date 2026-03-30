import { NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { listBudgetRequests } from "@/lib/services/budget.service";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/approvals — all pending items for HOP
export async function GET() {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    // Pending budget requests
    const budgetRequests = await listBudgetRequests({ status: "Pending" });

    // Pending invoice approvals (Invoice Pre-Approved → needs HOP approval)
    const { data: pendingInvoices } = await db
      .from("campaign_vendors")
      .select("*, vendors(company_name), campaigns(name, wf_number)")
      .eq("status", "Invoice Pre-Approved")
      .order("updated_at", { ascending: false });

    return NextResponse.json({
      budgetRequests,
      pendingInvoices: (pendingInvoices || []).map((row) => ({
        id: row.id,
        campaignId: row.campaign_id,
        vendorName: row.vendors?.company_name || "Unknown",
        campaignName: row.campaigns?.name || "Unknown",
        wfNumber: row.campaigns?.wf_number || "",
        estimateTotal: Number(row.estimate_total),
        invoiceTotal: Number(row.invoice_total),
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
