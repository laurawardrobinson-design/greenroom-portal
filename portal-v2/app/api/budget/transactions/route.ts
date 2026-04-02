import { NextRequest, NextResponse } from "next/server";
import { requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/budget/transactions?vendorId=xxx  OR  ?category=xxx
 *
 * Returns recent invoice line items for a specific vendor or category,
 * used for the drill-down popup in the HOP budget analysis view.
 */
export async function GET(req: NextRequest) {
  try {
    await requireRole(["Admin"]);
    const db = createAdminClient();

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");
    const category = searchParams.get("category");

    if (!vendorId && !category) {
      return NextResponse.json({ error: "vendorId or category required" }, { status: 400 });
    }

    if (vendorId) {
      // Get all campaign_vendor assignments for this vendor
      const { data: assignments } = await db
        .from("campaign_vendors")
        .select("id, campaign_id, estimate_total, invoice_total, payment_amount, payment_date, status, campaigns(name, wf_number)")
        .eq("vendor_id", vendorId)
        .neq("status", "Rejected")
        .order("created_at", { ascending: false })
        .limit(20);

      const cvIds = (assignments || []).map((a: any) => a.id);

      // Get invoices for these assignments
      const { data: invoices } = cvIds.length > 0
        ? await db
            .from("vendor_invoices")
            .select("id, campaign_vendor_id, file_name, created_at, producer_approved_at, hop_approved_at")
            .in("campaign_vendor_id", cvIds)
            .order("created_at", { ascending: false })
            .limit(20)
        : { data: [] };

      // Get invoice line items
      const invoiceIds = (invoices || []).map((inv: any) => inv.id);
      const { data: lineItems } = invoiceIds.length > 0
        ? await db
            .from("vendor_invoice_items")
            .select("id, invoice_id, description, category, amount, flagged")
            .in("invoice_id", invoiceIds)
            .order("amount", { ascending: false })
        : { data: [] };

      // Build invoice lookup
      const invoiceByCv = new Map<string, any[]>();
      for (const inv of invoices || []) {
        const arr = invoiceByCv.get(inv.campaign_vendor_id) || [];
        arr.push(inv);
        invoiceByCv.set(inv.campaign_vendor_id, arr);
      }

      const lineItemsByInvoice = new Map<string, any[]>();
      for (const li of lineItems || []) {
        const arr = lineItemsByInvoice.get(li.invoice_id) || [];
        arr.push(li);
        lineItemsByInvoice.set(li.invoice_id, arr);
      }

      const transactions = (assignments || []).map((a: any) => ({
        campaignVendorId: a.id,
        campaignName: a.campaigns?.name || "Unknown",
        wfNumber: a.campaigns?.wf_number || "",
        status: a.status,
        estimateTotal: Number(a.estimate_total) || 0,
        invoiceTotal: Number(a.invoice_total) || 0,
        paidAmount: Number(a.payment_amount) || 0,
        paidDate: a.payment_date,
        invoices: (invoiceByCv.get(a.id) || []).map((inv: any) => ({
          id: inv.id,
          fileName: inv.file_name,
          createdAt: inv.created_at,
          producerApproved: !!inv.producer_approved_at,
          hopApproved: !!inv.hop_approved_at,
          lineItems: (lineItemsByInvoice.get(inv.id) || []).map((li: any) => ({
            description: li.description,
            category: li.category,
            amount: Number(li.amount),
            flagged: li.flagged,
          })),
        })),
      }));

      return NextResponse.json({ type: "vendor", transactions });
    }

    // ── Category drilldown ──
    if (category) {
      // Get all invoice line items in this category
      const { data: lineItems } = await db
        .from("vendor_invoice_items")
        .select("id, invoice_id, description, category, amount, flagged, vendor_invoices!inner(id, campaign_vendor_id, file_name, created_at)")
        .eq("category", category)
        .order("amount", { ascending: false })
        .limit(50);

      // Get campaign_vendor info for each
      const cvIds = [...new Set((lineItems || []).map((li: any) => li.vendor_invoices?.campaign_vendor_id).filter(Boolean))];
      const { data: assignments } = cvIds.length > 0
        ? await db
            .from("campaign_vendors")
            .select("id, vendor_id, campaign_id, status, vendors(company_name), campaigns(name, wf_number)")
            .in("id", cvIds)
        : { data: [] };

      const cvLookup = new Map<string, any>();
      for (const a of assignments || []) {
        cvLookup.set(a.id, a);
      }

      const transactions = (lineItems || []).map((li: any) => {
        const cvId = li.vendor_invoices?.campaign_vendor_id;
        const assignment = cvLookup.get(cvId);
        return {
          description: li.description,
          amount: Number(li.amount),
          flagged: li.flagged,
          invoiceFileName: li.vendor_invoices?.file_name,
          invoiceDate: li.vendor_invoices?.created_at,
          vendorName: assignment?.vendors?.company_name || "Unknown",
          campaignName: assignment?.campaigns?.name || "Unknown",
          wfNumber: assignment?.campaigns?.wf_number || "",
          status: assignment?.status || "",
        };
      });

      return NextResponse.json({ type: "category", transactions });
    }

    return NextResponse.json({ transactions: [] });
  } catch (error) {
    return authErrorResponse(error);
  }
}
