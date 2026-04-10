import { NextResponse } from "next/server";
import { getAuthUser, requireRole, authErrorResponse } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampaignVendorStatus } from "@/types/domain";

// GET /api/pending-documents
// Returns all CampaignVendors with status "Estimate Submitted" or "Invoice Submitted"
// (plus campaign info) for the current Producer/Admin.
export async function GET() {
  try {
    await requireRole(["Producer", "Admin"]);
    const user = await getAuthUser();
    const db = createAdminClient();

    const { data, error } = await db
      .from("campaign_vendors")
      .select(`
        *,
        vendors(id, company_name, contact_name, email, phone, category, title, specialty, tax_id, active, onboarded_date, notes, favorite_drinks, favorite_snacks, dietary_restrictions, allergies, energy_boost, favorite_publix_product, created_at, updated_at),
        campaigns(id, name, wf_number, producer_id)
      `)
      .in("status", ["Estimate Submitted", "Invoice Submitted"])
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const rows = (data || []).map((row: any) => {
      const vendor = row.vendors;
      const campaign = row.campaigns;
      return {
        // Full CampaignVendor shape
        id: row.id,
        campaignId: row.campaign_id,
        vendorId: row.vendor_id,
        status: row.status as CampaignVendorStatus,
        invitedAt: row.invited_at,
        estimateTotal: Number(row.estimate_total) || 0,
        estimateFileUrl: row.estimate_file_url || null,
        estimateFileName: row.estimate_file_name || null,
        poFileUrl: row.po_file_url || null,
        poSignedFileUrl: row.po_signed_file_url || null,
        poNumber: row.po_number || null,
        poSignedAt: row.po_signed_at || null,
        signatureUrl: row.signature_url || null,
        signatureName: row.signature_name || null,
        signedIp: row.signed_ip || null,
        signatureTimestamp: row.signature_timestamp || null,
        invoiceTotal: Number(row.invoice_total) || 0,
        paymentAmount: Number(row.payment_amount) || 0,
        paymentDate: row.payment_date || null,
        notes: row.notes || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        vendor: vendor ? {
          id: vendor.id,
          companyName: vendor.company_name,
          contactName: vendor.contact_name,
          email: vendor.email,
          phone: vendor.phone,
          category: vendor.category,
          title: vendor.title || "",
          specialty: vendor.specialty,
          taxId: vendor.tax_id,
          active: vendor.active,
          onboardedDate: vendor.onboarded_date || null,
          notes: vendor.notes,
          favoriteDrinks: vendor.favorite_drinks || "",
          favoriteSnacks: vendor.favorite_snacks || "",
          dietaryRestrictions: vendor.dietary_restrictions || "",
          allergies: vendor.allergies || "",
          energyBoost: vendor.energy_boost || "",
          favoritePublixProduct: vendor.favorite_publix_product || "",
          createdAt: vendor.created_at,
          updatedAt: vendor.updated_at,
        } : undefined,
        // Campaign info for display
        campaignName: campaign?.name || "Unknown Campaign",
        wfNumber: campaign?.wf_number || "",
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    return authErrorResponse(error);
  }
}
