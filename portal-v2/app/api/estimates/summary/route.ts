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
        "id, campaign_id, status, estimate_total, invoice_total, updated_at, estimate_file_url, estimate_file_name, po_file_url, po_number, po_signed_file_url, po_signed_at, signature_name, vendors(company_name), campaigns(name, wf_number)"
      )
      .in("campaign_id", campaignIds)
      .not("status", "eq", "Invited")
      .not("status", "eq", "Paid")
      .not("estimate_total", "is", null)
      .order("updated_at", { ascending: false });

    const vendorIds = (rows || []).map((r: any) => r.id as string);

    // Fetch latest invoice per vendor (separate query to get correct ordering)
    let invoiceByVendor = new Map<string, { file_url: string; file_name: string; storage_path: string | null }>();
    if (vendorIds.length > 0) {
      const { data: invoiceRows } = await db
        .from("vendor_invoices")
        .select("campaign_vendor_id, file_url, file_name, storage_path")
        .in("campaign_vendor_id", vendorIds)
        .order("created_at", { ascending: false });

      for (const inv of (invoiceRows || []) as any[]) {
        if (!invoiceByVendor.has(inv.campaign_vendor_id)) {
          invoiceByVendor.set(inv.campaign_vendor_id, inv);
        }
      }
    }

    // Generate signed URLs for invoices stored in private bucket
    async function refreshInvoiceUrl(storagePath: string): Promise<string | null> {
      const { data, error } = await db.storage
        .from("invoices")
        .createSignedUrl(storagePath, 900); // 15-minute expiry
      if (error || !data) return null;
      return data.signedUrl;
    }

    const items = await Promise.all(
      (rows || []).map(async (row: any) => {
        const inv = invoiceByVendor.get(row.id);
        let invoiceFileUrl: string | null = null;
        if (inv?.storage_path) {
          invoiceFileUrl = await refreshInvoiceUrl(inv.storage_path);
        } else if (inv?.file_url) {
          invoiceFileUrl = inv.file_url;
        }

        return {
          id: row.id as string,
          campaignId: row.campaign_id as string,
          campaignName: (row.campaigns as any)?.name || "Unknown Campaign",
          wfNumber: (row.campaigns as any)?.wf_number || "",
          vendorName: (row.vendors as any)?.company_name || "Unknown Vendor",
          status: row.status as string,
          estimateTotal: Number(row.estimate_total || 0),
          invoiceTotal: row.invoice_total != null ? Number(row.invoice_total) : null,
          updatedAt: row.updated_at as string,
          estimateFileUrl: (row.estimate_file_url as string | null) || null,
          estimateFileName: (row.estimate_file_name as string | null) || null,
          poFileUrl: (row.po_file_url as string | null) || null,
          poNumber: (row.po_number as string | null) || null,
          poSignedFileUrl: (row.po_signed_file_url as string | null) || null,
          poSignedAt: (row.po_signed_at as string | null) || null,
          signatureName: (row.signature_name as string | null) || null,
          invoiceFileUrl,
          invoiceFileName: inv?.file_name || null,
        };
      })
    );

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
