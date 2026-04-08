import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CampaignVendor,
  CampaignVendorStatus,
  VendorEstimateItem,
} from "@/types/domain";
import { VENDOR_STATUS_TRANSITIONS } from "@/lib/constants/statuses";
import type { EstimateItemInput } from "@/lib/validation/estimates.schema";
import { generatePOPdf, type POItem } from "@/lib/utils/pdf-generator";

function toCampaignVendor(row: Record<string, unknown>): CampaignVendor {
  const vendor = row.vendors as Record<string, unknown> | undefined;
  const campaignRelation = row.campaigns as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | undefined;
  const campaign = Array.isArray(campaignRelation)
    ? (campaignRelation[0] as Record<string, unknown> | undefined)
    : campaignRelation;
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    vendorId: row.vendor_id as string,
    campaignName: (campaign?.name as string) || "",
    campaignWfNumber: (campaign?.wf_number as string) || "",
    status: row.status as CampaignVendorStatus,
    invitedAt: row.invited_at as string,
    estimateTotal: Number(row.estimate_total) || 0,
    poFileUrl: (row.po_file_url as string) || null,
    poSignedFileUrl: (row.po_signed_file_url as string) || null,
    poSignedAt: (row.po_signed_at as string) || null,
    signatureUrl: (row.signature_url as string) || null,
    signedIp: (row.signed_ip as string) || null,
    signatureTimestamp: (row.signature_timestamp as string) || null,
    invoiceTotal: Number(row.invoice_total) || 0,
    paymentAmount: Number(row.payment_amount) || 0,
    paymentDate: (row.payment_date as string) || null,
    notes: row.notes as string,
    estimateFeedback: (row.estimate_feedback as string) || "",
    estimateFeedbackAt: (row.estimate_feedback_at as string) || null,
    assignedShootDateIds:
      (row.assigned_shoot_date_ids as string[] | null | undefined) ?? null,
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
          title: (vendor.title as string) || "",
          specialty: vendor.specialty as string,
          taxId: vendor.tax_id as string,
          active: vendor.active as boolean,
          onboardedDate: (vendor.onboarded_date as string) || null,
          notes: vendor.notes as string,
          favoriteDrinks: (vendor.favorite_drinks as string) || "",
          favoriteSnacks: (vendor.favorite_snacks as string) || "",
          dietaryRestrictions: (vendor.dietary_restrictions as string) || "",
          allergies: (vendor.allergies as string) || "",
          energyBoost: (vendor.energy_boost as string) || "",
          favoritePublixProduct: (vendor.favorite_publix_product as string) || "",
          createdAt: vendor.created_at as string,
          updatedAt: vendor.updated_at as string,
        }
      : undefined,
  };
}

function getSingleRelationRow(
  value:
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null
    | undefined
): Record<string, unknown> | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function sanitizeFileToken(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]/g, "-");
  return cleaned.length > 0 ? cleaned : "po";
}

async function generatePoSnapshotForAssignment(
  db: ReturnType<typeof createAdminClient>,
  campaignVendorId: string,
  poNumberOverride?: string | null
): Promise<string> {
  const { data: cv, error: cvError } = await db
    .from("campaign_vendors")
    .select(
      "id, campaign_id, po_number, estimate_total, notes, vendors(company_name, contact_name, email, phone), campaigns(name, wf_number)"
    )
    .eq("id", campaignVendorId)
    .single();

  if (cvError || !cv) {
    throw new Error("Unable to load purchase order snapshot source");
  }

  const vendor = getSingleRelationRow(
    cv.vendors as Record<string, unknown> | Record<string, unknown>[] | null
  );
  const campaign = getSingleRelationRow(
    cv.campaigns as Record<string, unknown> | Record<string, unknown>[] | null
  );

  const { data: estimateRows, error: estimateError } = await db
    .from("vendor_estimate_items")
    .select("description, quantity, unit_price, amount, sort_order")
    .eq("campaign_vendor_id", campaignVendorId)
    .order("sort_order", { ascending: true });
  if (estimateError) throw estimateError;

  const poItems: POItem[] =
    estimateRows && estimateRows.length > 0
      ? estimateRows.map((row) => ({
          description: (row.description as string) || "",
          quantity: Number(row.quantity) || 0,
          unitPrice: Number(row.unit_price) || 0,
          amount: Number(row.amount) || 0,
        }))
      : [
          {
            description: "Approved estimate total",
            quantity: 1,
            unitPrice: Number(cv.estimate_total) || 0,
            amount: Number(cv.estimate_total) || 0,
          },
        ];

  const totalAmount = poItems.reduce((sum, item) => sum + item.amount, 0);
  const wfNumber = (campaign?.wf_number as string | undefined) || "WF";
  const poNumber =
    (typeof poNumberOverride === "string" && poNumberOverride.trim()) ||
    (cv.po_number as string | null) ||
    `PO-${wfNumber}`;

  const pdf = generatePOPdf({
    vendorName: (vendor?.company_name as string | undefined) || "Vendor",
    vendorContact: (vendor?.contact_name as string | undefined) || "Vendor Contact",
    vendorEmail: (vendor?.email as string | undefined) || "vendor@example.com",
    vendorPhone: (vendor?.phone as string | undefined) || "N/A",
    campaignName: (campaign?.name as string | undefined) || "Campaign",
    wfNumber,
    poDate: new Date().toISOString().split("T")[0],
    poNumber,
    items: poItems,
    totalAmount,
    notes: ((cv.notes as string | undefined) || "").trim() || undefined,
  });

  const safePoNumber = sanitizeFileToken(poNumber);
  const fileName = `${safePoNumber}-snapshot.pdf`;
  const storagePath = `campaigns/${cv.campaign_id}/po-snapshots/${campaignVendorId}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await db.storage
    .from("campaign-assets")
    .upload(storagePath, Buffer.from(pdf.output("arraybuffer")), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: urlData } = db.storage
    .from("campaign-assets")
    .getPublicUrl(storagePath);
  return urlData.publicUrl;
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
    .select("*, vendors(*), campaigns(id, name, wf_number)")
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
  vendorId: string,
  assignedShootDateIds?: string[] | null
): Promise<CampaignVendor> {
  const db = createAdminClient();
  const normalizedShootDateIds = Array.isArray(assignedShootDateIds)
    ? [...new Set(assignedShootDateIds.filter((id) => !!id))]
    : null;

  async function createAssignment(includeShootDateScope: boolean) {
    const payload: {
      campaign_id: string;
      vendor_id: string;
      status: CampaignVendorStatus;
      assigned_shoot_date_ids?: string[] | null;
    } = {
      campaign_id: campaignId,
      vendor_id: vendorId,
      status: "Invited",
    };
    if (includeShootDateScope) {
      payload.assigned_shoot_date_ids = normalizedShootDateIds;
    }
    return db
      .from("campaign_vendors")
      .insert(payload)
      .select("*, vendors(*)")
      .single();
  }

  let { data, error } = await createAssignment(true);
  const isMissingShootDateColumn =
    error?.code === "42703" &&
    typeof error.message === "string" &&
    error.message.includes("assigned_shoot_date_ids");

  // Backward compatibility for environments where migration 052 isn't applied yet.
  if (isMissingShootDateColumn) {
    ({ data, error } = await createAssignment(false));
  }

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
    .select("status, po_file_url, po_number")
    .eq("id", campaignVendorId)
    .single();

  if (fetchErr || !current) throw new Error("Assignment not found");

  const currentStatus = current.status as CampaignVendorStatus;
  const allowed = VENDOR_STATUS_TRANSITIONS[currentStatus];
  const isPoDocumentReplacement =
    currentStatus === "PO Uploaded" && targetStatus === "PO Uploaded";

  if (!allowed.includes(targetStatus) && !isPoDocumentReplacement) {
    throw new Error(
      `Cannot transition from "${currentStatus}" to "${targetStatus}"`
    );
  }

  // Build update data based on transition
  const updateData: Record<string, unknown> = { status: targetStatus };

  if (targetStatus === "PO Signed" && payload) {
    const signatureUrl =
      typeof payload.signatureUrl === "string" ? payload.signatureUrl : "";
    const signatureName =
      typeof payload.signatureName === "string" ? payload.signatureName.trim() : "";
    if (!signatureUrl || !signatureName) {
      throw new Error("Signature and printed name are required");
    }

    const currentPoFileUrl =
      typeof current.po_file_url === "string" ? current.po_file_url : "";
    if (!currentPoFileUrl) {
      throw new Error("Cannot sign PO without an uploaded PO document");
    }

    let immutablePoUrl = currentPoFileUrl;
    const enforcePoSnapshot = payload.enforcePoSnapshot === true;
    if (enforcePoSnapshot && currentPoFileUrl.startsWith("/po/")) {
      immutablePoUrl = await generatePoSnapshotForAssignment(
        db,
        campaignVendorId,
        (current.po_number as string | null) ?? null
      );
      updateData.po_file_url = immutablePoUrl;
    }

    updateData.po_signed_at = new Date().toISOString();
    updateData.signature_url = signatureUrl;
    updateData.signed_ip = payload.signedIp;
    updateData.signature_name = signatureName;
    updateData.signature_timestamp = new Date().toISOString();
    updateData.po_signed_file_url = immutablePoUrl;
  }

  if (targetStatus === "PO Uploaded") {
    const poFileUrl =
      typeof payload?.poFileUrl === "string" ? payload.poFileUrl.trim() : "";
    if (!poFileUrl) {
      throw new Error("PO file URL is required for PO Uploaded");
    }
    const shouldGeneratePoSnapshot =
      payload?.generatePoSnapshot === true && poFileUrl.startsWith("/po/");
    updateData.po_file_url = shouldGeneratePoSnapshot
      ? await generatePoSnapshotForAssignment(
          db,
          campaignVendorId,
          typeof payload?.poNumber === "string" ? payload.poNumber : null
        )
      : poFileUrl;
    if (typeof payload?.poNumber === "string" && payload.poNumber.trim()) {
      updateData.po_number = payload.poNumber.trim();
    }
  }

  if (targetStatus === "Paid" && payload) {
    updateData.payment_amount = payload.paymentAmount;
    updateData.payment_date =
      payload.paymentDate || new Date().toISOString().split("T")[0];
  }

  if (targetStatus === "Rejected" && payload?.notes) {
    updateData.notes = payload.notes;
  }

  if (targetStatus === "Estimate Revision Requested") {
    const feedback =
      typeof payload?.feedback === "string" ? payload.feedback.trim() : "";
    if (!feedback) {
      throw new Error(
        "Revision feedback is required when requesting estimate changes"
      );
    }
    updateData.estimate_feedback = feedback;
    updateData.estimate_feedback_at = new Date().toISOString();
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
  items: EstimateItemInput[],
  options?: {
    estimateFileUrl?: string | null;
    estimateFileName?: string | null;
  }
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

  // Update total and transition status.
  // Backward compatibility: older databases may not have estimate_feedback*
  // or estimate_file_* columns yet.
  const baseUpdate: Record<string, unknown> = {
    estimate_total: total,
    status: "Estimate Submitted",
  };

  const fileColumnsUpdate: Record<string, unknown> = options
    ? {
        estimate_file_url: options.estimateFileUrl ?? null,
        estimate_file_name: options.estimateFileName ?? null,
      }
    : {};

  const attempts: Record<string, unknown>[] = [
    {
      ...baseUpdate,
      estimate_feedback: "",
      estimate_feedback_at: null,
      ...fileColumnsUpdate,
    },
    {
      ...baseUpdate,
      ...fileColumnsUpdate,
    },
    {
      ...baseUpdate,
    },
  ];

  let lastError: { code?: string; message?: string } | null = null;
  for (const payload of attempts) {
    const { error } = await db
      .from("campaign_vendors")
      .update(payload)
      .eq("id", campaignVendorId);

    if (!error) return;
    lastError = error;

    const isMissingColumn =
      error.code === "42703" || // postgres undefined_column
      error.code === "PGRST204"; // postgrest missing column in schema cache

    if (!isMissingColumn) {
      throw error;
    }
  }

  if (lastError) throw lastError;
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
