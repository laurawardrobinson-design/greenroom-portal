import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CampaignVendor,
  CampaignVendorStatus,
  Vendor,
  VendorEstimateItem,
} from "@/types/domain";
import { VENDOR_STATUS_TRANSITIONS } from "@/lib/constants/statuses";
import type { EstimateItemInput } from "@/lib/validation/estimates.schema";

function toCampaignVendor(row: Record<string, unknown>): CampaignVendor {
  const vendor = row.vendors as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    vendorId: row.vendor_id as string,
    status: row.status as CampaignVendorStatus,
    invitedAt: row.invited_at as string,
    estimateTotal: Number(row.estimate_total) || 0,
    poFileUrl: (row.po_file_url as string) || null,
    poSignedAt: (row.po_signed_at as string) || null,
    signatureUrl: (row.signature_url as string) || null,
    signedIp: (row.signed_ip as string) || null,
    signatureTimestamp: (row.signature_timestamp as string) || null,
    invoiceTotal: Number(row.invoice_total) || 0,
    paymentAmount: Number(row.payment_amount) || 0,
    paymentDate: (row.payment_date as string) || null,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    vendor: vendor
      ? {
          id: vendor.id as string,
          companyName: vendor.company_name as string,
          contactName: vendor.contact_name as string,
          email: vendor.email as string,
          phone: vendor.phone as string,
          category: vendor.category as string,
          specialty: vendor.specialty as string,
          taxId: vendor.tax_id as string,
          active: vendor.active as boolean,
          onboardedDate: (vendor.onboarded_date as string) || null,
          notes: vendor.notes as string,
          createdAt: vendor.created_at as string,
          updatedAt: vendor.updated_at as string,
        }
      : undefined,
  };
}

// List vendor assignments for a campaign
export async function listCampaignVendors(
  campaignId: string
): Promise<CampaignVendor[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_vendors")
    .select("*, vendors(*)")
    .eq("campaign_id", campaignId)
    .order("invited_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(toCampaignVendor);
}

// List all assignments for a specific vendor (across campaigns)
export async function listVendorAssignments(
  vendorId: string
): Promise<CampaignVendor[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_vendors")
    .select("*, vendors(*)")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(toCampaignVendor);
}

// Get a single campaign-vendor assignment
export async function getCampaignVendor(
  id: string
): Promise<CampaignVendor | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_vendors")
    .select("*, vendors(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  return toCampaignVendor(data);
}

// Assign a vendor to a campaign (starts at "Invited")
export async function assignVendorToCampaign(
  campaignId: string,
  vendorId: string
): Promise<CampaignVendor> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_vendors")
    .insert({
      campaign_id: campaignId,
      vendor_id: vendorId,
      status: "Invited",
    })
    .select("*, vendors(*)")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This vendor is already assigned to this campaign");
    }
    throw error;
  }
  return toCampaignVendor(data);
}

// Transition the vendor status (state machine)
export async function transitionVendorStatus(
  campaignVendorId: string,
  targetStatus: CampaignVendorStatus,
  payload?: Record<string, unknown>
): Promise<CampaignVendor> {
  const db = createAdminClient();

  // Get current status
  const { data: current, error: fetchErr } = await db
    .from("campaign_vendors")
    .select("status")
    .eq("id", campaignVendorId)
    .single();

  if (fetchErr || !current) throw new Error("Assignment not found");

  const currentStatus = current.status as CampaignVendorStatus;
  const allowed = VENDOR_STATUS_TRANSITIONS[currentStatus];

  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Cannot transition from "${currentStatus}" to "${targetStatus}"`
    );
  }

  // Build update data based on transition
  const updateData: Record<string, unknown> = { status: targetStatus };

  if (targetStatus === "PO Signed" && payload) {
    updateData.po_signed_at = new Date().toISOString();
    updateData.signature_url = payload.signatureUrl;
    updateData.signed_ip = payload.signedIp;
    updateData.signature_name = payload.signatureName;
    updateData.signature_timestamp = new Date().toISOString();
  }

  if (targetStatus === "PO Uploaded" && payload?.poFileUrl) {
    updateData.po_file_url = payload.poFileUrl;
  }

  if (targetStatus === "Paid" && payload) {
    updateData.payment_amount = payload.paymentAmount;
    updateData.payment_date =
      payload.paymentDate || new Date().toISOString().split("T")[0];
  }

  const { data, error } = await db
    .from("campaign_vendors")
    .update(updateData)
    .eq("id", campaignVendorId)
    .select("*, vendors(*)")
    .single();

  if (error) throw error;
  return toCampaignVendor(data);
}

// Submit estimate (vendor submits itemized line items)
export async function submitEstimate(
  campaignVendorId: string,
  items: EstimateItemInput[]
): Promise<void> {
  const db = createAdminClient();

  // Calculate total
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  // Insert estimate items
  const rows = items.map((item, i) => ({
    campaign_vendor_id: campaignVendorId,
    category: item.category,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    amount: item.amount,
    sort_order: i,
  }));

  // Delete existing items (in case of resubmission)
  await db
    .from("vendor_estimate_items")
    .delete()
    .eq("campaign_vendor_id", campaignVendorId);

  const { error: insertErr } = await db
    .from("vendor_estimate_items")
    .insert(rows);
  if (insertErr) throw insertErr;

  // Update total and transition status
  const { error: updateErr } = await db
    .from("campaign_vendors")
    .update({ estimate_total: total, status: "Estimate Submitted" })
    .eq("id", campaignVendorId);
  if (updateErr) throw updateErr;
}

// Get estimate items for a campaign vendor
export async function getEstimateItems(
  campaignVendorId: string
): Promise<VendorEstimateItem[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendor_estimate_items")
    .select("*")
    .eq("campaign_vendor_id", campaignVendorId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    campaignVendorId: row.campaign_vendor_id,
    category: row.category,
    description: row.description,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    amount: Number(row.amount),
    sortOrder: row.sort_order,
  }));
}

// Remove vendor from campaign
export async function removeVendorFromCampaign(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("campaign_vendors").delete().eq("id", id);
  if (error) throw error;
}
