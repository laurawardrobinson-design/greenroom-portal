import { NextResponse } from "next/server";
import { authErrorResponse, getAuthUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/invoices/view/[id] — full invoice view data for a campaign_vendor_id
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAuthUser();
    const { id } = await params;
    const db = createAdminClient();

    // Campaign vendor with vendor + campaign info
    const { data: cv, error: cvError } = await db
      .from("campaign_vendors")
      .select("*, vendors(*), campaigns(id, name, wf_number)")
      .eq("id", id)
      .single();

    if (cvError || !cv) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Estimate items
    const { data: estimateItems } = await db
      .from("vendor_estimate_items")
      .select("*")
      .eq("campaign_vendor_id", id)
      .order("sort_order", { ascending: true });

    // Invoice record (most recent)
    const { data: invoice } = await db
      .from("vendor_invoices")
      .select("*")
      .eq("campaign_vendor_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Invoice items if available
    let invoiceItems: unknown[] = [];
    if (invoice) {
      const { data: items } = await db
        .from("vendor_invoice_items")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("sort_order", { ascending: true });
      invoiceItems = items || [];
    }

    return NextResponse.json({
      cv,
      estimateItems: estimateItems || [],
      invoice: invoice || null,
      invoiceItems,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
