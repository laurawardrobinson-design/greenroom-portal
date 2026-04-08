import { NextResponse } from "next/server";
import { authErrorResponse, getAuthUser } from "@/lib/auth/guards";
import { isWorkflowFeatureEnabled } from "@/lib/services/feature-flags.service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignVendorStatus, InvoiceParseStatus } from "@/types/domain";

type CampaignVendorRow = {
  id: string;
  campaign_id: string;
  vendor_id: string;
  status: CampaignVendorStatus;
  estimate_total: number | string | null;
  invoice_total: number | string | null;
  updated_at: string;
  estimate_file_url: string | null;
  estimate_file_name: string | null;
  po_file_url: string | null;
  po_number: string | null;
  po_signed_file_url: string | null;
  po_signed_at: string | null;
  signature_name: string | null;
  vendors:
    | { company_name: string | null }
    | Array<{ company_name: string | null }>
    | null;
  campaigns: {
    id: string;
    name: string | null;
    wf_number: string | null;
    producer_id: string | null;
  } | Array<{
    id: string;
    name: string | null;
    wf_number: string | null;
    producer_id: string | null;
  }> | null;
};

type InvoiceRow = {
  id: string;
  campaign_vendor_id: string;
  file_url: string;
  file_name: string;
  storage_path: string | null;
  parse_status: InvoiceParseStatus;
  producer_approved_at: string | null;
  hop_approved_at: string | null;
  created_at: string;
};

// GET /api/financial-documents
// Role-scoped financial packet list (estimate, PO, invoice) for Admin, Producer, Vendor.
export async function GET() {
  try {
    const enabled = await isWorkflowFeatureEnabled("workflow_documents_center_v2");
    if (!enabled) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = await getAuthUser();
    const db = createAdminClient();

    if (!["Admin", "Producer", "Vendor"].includes(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (user.role === "Vendor" && !user.vendorId) {
      return NextResponse.json({ items: [] });
    }

    let query = db
      .from("campaign_vendors")
      .select(
        "id, campaign_id, vendor_id, status, estimate_total, invoice_total, updated_at, estimate_file_url, estimate_file_name, po_file_url, po_number, po_signed_file_url, po_signed_at, signature_name, vendors(company_name), campaigns!inner(id, name, wf_number, producer_id)"
      )
      .neq("status", "Invited")
      .order("updated_at", { ascending: false });

    if (user.role === "Vendor") {
      query = query.eq("vendor_id", user.vendorId as string);
    } else if (user.role === "Producer") {
      query = query.eq("campaigns.producer_id", user.id);
    }

    const { data: assignmentRows, error: assignmentError } = await query;
    if (assignmentError) throw assignmentError;

    const rows = (assignmentRows || []) as CampaignVendorRow[];
    if (rows.length === 0) {
      return NextResponse.json({ items: [] });
    }

    function firstRelation<T>(value: T | T[] | null | undefined): T | null {
      if (!value) return null;
      return Array.isArray(value) ? (value[0] ?? null) : value;
    }

    const assignmentIds = rows.map((row) => row.id);

    const { data: invoiceRows, error: invoiceError } = await db
      .from("vendor_invoices")
      .select(
        "id, campaign_vendor_id, file_url, file_name, storage_path, parse_status, producer_approved_at, hop_approved_at, created_at"
      )
      .in("campaign_vendor_id", assignmentIds)
      .order("created_at", { ascending: false });
    if (invoiceError) throw invoiceError;

    const latestInvoiceByAssignment = new Map<string, InvoiceRow>();
    for (const raw of (invoiceRows || []) as InvoiceRow[]) {
      if (!latestInvoiceByAssignment.has(raw.campaign_vendor_id)) {
        latestInvoiceByAssignment.set(raw.campaign_vendor_id, raw);
      }
    }

    async function buildInvoiceUrl(invoice: InvoiceRow | undefined): Promise<string | null> {
      if (!invoice) return null;
      if (!invoice.storage_path) return invoice.file_url || null;

      const { data, error } = await db.storage
        .from("invoices")
        .createSignedUrl(invoice.storage_path, 900);
      if (error || !data) return null;
      return data.signedUrl;
    }

    const items = await Promise.all(
      rows.map(async (row) => {
        const latestInvoice = latestInvoiceByAssignment.get(row.id);
        const invoiceFileUrl = await buildInvoiceUrl(latestInvoice);
        const campaign = firstRelation(row.campaigns);
        const vendor = firstRelation(row.vendors);

        return {
          id: row.id,
          campaignId: row.campaign_id,
          campaignName: campaign?.name || "Unknown Campaign",
          wfNumber: campaign?.wf_number || "",
          vendorName: vendor?.company_name || "Unknown Vendor",
          status: row.status,
          estimateTotal: Number(row.estimate_total || 0),
          invoiceTotal:
            row.invoice_total !== null ? Number(row.invoice_total || 0) : null,
          updatedAt: row.updated_at,
          estimateFileUrl: row.estimate_file_url,
          estimateFileName: row.estimate_file_name,
          poFileUrl: row.po_file_url,
          poNumber: row.po_number,
          poSignedFileUrl: row.po_signed_file_url,
          poSignedAt: row.po_signed_at,
          signatureName: row.signature_name,
          invoice: latestInvoice
            ? {
                id: latestInvoice.id,
                fileUrl: invoiceFileUrl,
                fileName: latestInvoice.file_name,
                parseStatus: latestInvoice.parse_status,
                producerApprovedAt: latestInvoice.producer_approved_at,
                hopApprovedAt: latestInvoice.hop_approved_at,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ items });
  } catch (error) {
    return authErrorResponse(error);
  }
}
