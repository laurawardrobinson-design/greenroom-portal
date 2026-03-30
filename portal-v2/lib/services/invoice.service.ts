import { createAdminClient } from "@/lib/supabase/admin";
import type { VendorInvoice, VendorInvoiceItem, InvoiceFlag } from "@/types/domain";

function toInvoice(row: Record<string, unknown>): VendorInvoice {
  return {
    id: row.id as string,
    campaignVendorId: row.campaign_vendor_id as string,
    fileUrl: row.file_url as string,
    fileName: row.file_name as string,
    submittedAt: row.submitted_at as string,
    parsedData: (row.parsed_data as Record<string, unknown>) || null,
    autoFlags: (row.auto_flags as InvoiceFlag[]) || null,
    parseStatus: row.parse_status as VendorInvoice["parseStatus"],
    producerApprovedAt: (row.producer_approved_at as string) || null,
    producerApprovedBy: (row.producer_approved_by as string) || null,
    hopApprovedAt: (row.hop_approved_at as string) || null,
    hopApprovedBy: (row.hop_approved_by as string) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toInvoiceItem(row: Record<string, unknown>): VendorInvoiceItem {
  return {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    category: row.category as VendorInvoiceItem["category"],
    description: row.description as string,
    amount: Number(row.amount) || 0,
    matchedEstimateItemId: (row.matched_estimate_item_id as string) || null,
    flagged: !!row.flagged,
    flagReason: (row.flag_reason as string) || "",
    sortOrder: Number(row.sort_order) || 0,
  };
}

export async function createInvoice(input: {
  campaignVendorId: string;
  fileUrl: string;
  fileName: string;
}): Promise<VendorInvoice> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendor_invoices")
    .insert({
      campaign_vendor_id: input.campaignVendorId,
      file_url: input.fileUrl,
      file_name: input.fileName,
      parse_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return toInvoice(data);
}

export async function getInvoiceForCampaignVendor(
  campaignVendorId: string
): Promise<{ invoice: VendorInvoice; items: VendorInvoiceItem[] } | null> {
  const db = createAdminClient();
  const { data: invoice, error } = await db
    .from("vendor_invoices")
    .select("*")
    .eq("campaign_vendor_id", campaignVendorId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !invoice) return null;

  const { data: items } = await db
    .from("vendor_invoice_items")
    .select("*")
    .eq("invoice_id", invoice.id)
    .order("sort_order", { ascending: true });

  return {
    invoice: toInvoice(invoice),
    items: (items || []).map(toInvoiceItem),
  };
}

export async function approveInvoice(input: {
  invoiceId: string;
  approverType: "producer" | "hop";
  userId: string;
}): Promise<void> {
  const db = createAdminClient();
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> =
    input.approverType === "producer"
      ? { producer_approved_at: now, producer_approved_by: input.userId }
      : { hop_approved_at: now, hop_approved_by: input.userId };

  const { error } = await db
    .from("vendor_invoices")
    .update(updateData)
    .eq("id", input.invoiceId);

  if (error) throw error;
}

export async function updateInvoiceParsed(input: {
  invoiceId: string;
  parsedData: Record<string, unknown>;
  autoFlags: InvoiceFlag[];
  items: Array<{
    category: string;
    description: string;
    amount: number;
    matchedEstimateItemId?: string;
    flagged: boolean;
    flagReason: string;
  }>;
}): Promise<void> {
  const db = createAdminClient();

  // Update invoice record
  const { error: updateErr } = await db
    .from("vendor_invoices")
    .update({
      parsed_data: input.parsedData,
      auto_flags: input.autoFlags,
      parse_status: "completed",
    })
    .eq("id", input.invoiceId);

  if (updateErr) throw updateErr;

  // Insert parsed items
  if (input.items.length > 0) {
    const rows = input.items.map((item, i) => ({
      invoice_id: input.invoiceId,
      category: item.category,
      description: item.description,
      amount: item.amount,
      matched_estimate_item_id: item.matchedEstimateItemId || null,
      flagged: item.flagged,
      flag_reason: item.flagReason,
      sort_order: i,
    }));

    const { error: insertErr } = await db
      .from("vendor_invoice_items")
      .insert(rows);

    if (insertErr) throw insertErr;
  }

  // Calculate total and update campaign_vendors
  const total = input.items.reduce((sum, item) => sum + item.amount, 0);
  const { data: inv } = await db
    .from("vendor_invoices")
    .select("campaign_vendor_id")
    .eq("id", input.invoiceId)
    .single();

  if (inv) {
    await db
      .from("campaign_vendors")
      .update({ invoice_total: total })
      .eq("id", inv.campaign_vendor_id);
  }
}
