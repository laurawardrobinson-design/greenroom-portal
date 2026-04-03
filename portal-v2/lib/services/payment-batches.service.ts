import { createAdminClient } from "@/lib/supabase/admin";
import type { PaymentBatch, PaymentBatchItem, PaymentBatchStatus } from "@/types/domain";

// ─── Default onboarding items seeded per vendor on first access ───
export const DEFAULT_ONBOARDING_ITEMS = [
  "W-9 on File",
  "Direct Deposit Setup",
  "I-9 Verified",
  "Deal Memo Signed",
];

// ─── Mappers ───

function toItem(row: Record<string, unknown>): PaymentBatchItem {
  const payment = row.crew_payments as Record<string, unknown> | undefined;
  const booking = payment?.crew_bookings as Record<string, unknown> | undefined;
  const vendor = booking?.vendors as Record<string, unknown> | undefined;
  const crewPerson = booking?.crew_person as Record<string, unknown> | undefined;
  const campaign = booking?.campaigns as Record<string, unknown> | undefined;

  const personName = vendor
    ? (vendor.contact_name as string) || (vendor.company_name as string)
    : crewPerson
    ? (crewPerson.name as string)
    : "Unknown";

  return {
    id: row.id as string,
    batchId: row.batch_id as string,
    crewPaymentId: row.crew_payment_id as string,
    amount: Number(row.amount),
    createdAt: row.created_at as string,
    personName,
    role: (booking?.role as string) || "",
    campaignName: (campaign?.name as string) || "",
    wfNumber: (campaign?.wf_number as string) || "",
    campaignId: (booking?.campaign_id as string) || "",
    totalDays: payment ? Number(payment.total_days) : undefined,
    dayRate: booking ? Number(booking.day_rate) : undefined,
    classification: (booking?.classification as string) || "",
  };
}

function toBatch(row: Record<string, unknown>, items?: PaymentBatchItem[]): PaymentBatch {
  return {
    id: row.id as string,
    name: row.name as string,
    status: row.status as PaymentBatchStatus,
    totalAmount: Number(row.total_amount),
    itemCount: Number(row.item_count),
    createdBy: row.created_by as string,
    sentAt: (row.sent_at as string) || null,
    confirmedAt: (row.confirmed_at as string) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    items,
  };
}

const ITEM_SELECT =
  "*, crew_payments!inner(total_days, crew_bookings!inner(campaign_id, role, day_rate, classification, vendor_id, user_id, vendors(contact_name, company_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number)))";

// ─── Queries ───

export async function listPaymentBatches(): Promise<PaymentBatch[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payment_batches")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row) => toBatch(row));
}

export async function getPaymentBatch(id: string): Promise<PaymentBatch | null> {
  const db = createAdminClient();

  const { data: batch, error } = await db
    .from("payment_batches")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;

  const { data: itemRows } = await db
    .from("payment_batch_items")
    .select(ITEM_SELECT)
    .eq("batch_id", id)
    .order("created_at", { ascending: true });

  const items = (itemRows || []).map((r) => toItem(r as Record<string, unknown>));
  return toBatch(batch, items);
}

export async function listApprovedUnbatchedPayments(): Promise<
  Array<{
    id: string;
    bookingId: string;
    totalDays: number;
    totalAmount: number;
    approvedAt: string | null;
    personName: string;
    role: string;
    campaignName: string;
    wfNumber: string;
    campaignId: string;
    dayRate: number;
    classification: string;
  }>
> {
  const db = createAdminClient();

  // Approved payments not already in a batch
  const { data: batchedIds } = await db
    .from("payment_batch_items")
    .select("crew_payment_id");

  const alreadyBatched = (batchedIds || []).map((r) => r.crew_payment_id);

  let query = db
    .from("crew_payments")
    .select(
      "*, crew_bookings!inner(campaign_id, role, day_rate, classification, vendor_id, user_id, vendors(contact_name, company_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number))"
    )
    .eq("status", "Approved")
    .order("approved_at", { ascending: false });

  if (alreadyBatched.length > 0) {
    query = query.not("id", "in", `(${alreadyBatched.join(",")})`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => {
    const booking = row.crew_bookings;
    const vendor = booking?.vendors;
    const crewPerson = booking?.crew_person;
    const campaign = booking?.campaigns;

    const personName = vendor
      ? vendor.contact_name || vendor.company_name
      : crewPerson?.name || "Unknown";

    return {
      id: row.id,
      bookingId: row.booking_id,
      totalDays: Number(row.total_days),
      totalAmount: Number(row.total_amount),
      approvedAt: row.approved_at || null,
      personName,
      role: booking?.role || "",
      campaignName: campaign?.name || "",
      wfNumber: campaign?.wf_number || "",
      campaignId: booking?.campaign_id || "",
      dayRate: Number(booking?.day_rate) || 0,
      classification: booking?.classification || "",
    };
  });
}

// ─── Mutations ───

export async function createPaymentBatch(createdBy: string): Promise<PaymentBatch> {
  const db = createAdminClient();

  const unbatched = await listApprovedUnbatchedPayments();
  if (unbatched.length === 0) throw new Error("No approved payments to batch");

  const totalAmount = unbatched.reduce((sum, p) => sum + p.totalAmount, 0);
  const now = new Date();
  const name = `Paymaster Batch — ${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const { data: batch, error } = await db
    .from("payment_batches")
    .insert({
      name,
      total_amount: totalAmount,
      item_count: unbatched.length,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;

  const items = unbatched.map((p) => ({
    batch_id: batch.id,
    crew_payment_id: p.id,
    amount: p.totalAmount,
  }));

  const { error: itemsError } = await db.from("payment_batch_items").insert(items);
  if (itemsError) throw itemsError;

  // Mark payments as Sent to Paymaster
  await db
    .from("crew_payments")
    .update({ status: "Sent to Paymaster" })
    .in("id", unbatched.map((p) => p.id));

  return (await getPaymentBatch(batch.id))!;
}

export async function updatePaymentBatchStatus(
  id: string,
  status: "Sent" | "Confirmed"
): Promise<PaymentBatch> {
  const db = createAdminClient();

  const updateData: Record<string, unknown> = { status };
  if (status === "Sent") updateData.sent_at = new Date().toISOString();
  if (status === "Confirmed") updateData.confirmed_at = new Date().toISOString();

  const { error } = await db
    .from("payment_batches")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;

  if (status === "Confirmed") {
    // Mark all crew payments in this batch as Paid
    const { data: items } = await db
      .from("payment_batch_items")
      .select("crew_payment_id")
      .eq("batch_id", id);

    if (items && items.length > 0) {
      await db
        .from("crew_payments")
        .update({ status: "Paid", paid_at: new Date().toISOString() })
        .in("id", items.map((i) => i.crew_payment_id));
    }
  }

  return (await getPaymentBatch(id))!;
}

// ─── CSV Export ───

export function generateBatchCSV(batch: PaymentBatch): string {
  const header = [
    "Name",
    "Role",
    "Campaign",
    "WF#",
    "Classification",
    "Days Worked",
    "Day Rate",
    "Total Amount",
  ].join(",");

  const rows = (batch.items || []).map((item) => {
    const cols = [
      `"${(item.personName || "").replace(/"/g, '""')}"`,
      `"${(item.role || "").replace(/"/g, '""')}"`,
      `"${(item.campaignName || "").replace(/"/g, '""')}"`,
      `"${(item.wfNumber || "").replace(/"/g, '""')}"`,
      `"${(item.classification || "").replace(/"/g, '""')}"`,
      item.totalDays ?? "",
      item.dayRate != null ? item.dayRate.toFixed(2) : "",
      item.amount.toFixed(2),
    ];
    return cols.join(",");
  });

  return [header, ...rows].join("\n");
}
