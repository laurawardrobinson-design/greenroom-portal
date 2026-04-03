import { createAdminClient } from "@/lib/supabase/admin";
import type { CrewPayment, CrewPaymentStatus } from "@/types/domain";

function toCrewPayment(row: Record<string, unknown>): CrewPayment {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    totalDays: Number(row.total_days) || 0,
    totalAmount: Number(row.total_amount) || 0,
    status: row.status as CrewPaymentStatus,
    notes: (row.notes as string) || "",
    confirmedBy: (row.confirmed_by as string) || null,
    confirmedAt: (row.confirmed_at as string) || null,
    approvedBy: (row.approved_by as string) || null,
    approvedAt: (row.approved_at as string) || null,
    paidAt: (row.paid_at as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// --- Queries ---

export async function getCrewPaymentByBookingId(
  bookingId: string
): Promise<CrewPayment | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("crew_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .single();

  if (error) return null;
  return toCrewPayment(data);
}

export async function listCrewPaymentsByCampaign(campaignId: string): Promise<
  Array<
    CrewPayment & {
      personName: string;
      role: string;
      campaignName: string;
      wfNumber: string;
      campaignId: string;
    }
  >
> {
  const db = createAdminClient();

  // Join through crew_bookings → campaigns and vendors/users
  const { data, error } = await db
    .from("crew_payments")
    .select(
      "*, crew_bookings!inner(campaign_id, role, vendor_id, user_id, vendors(contact_name, company_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number))"
    )
    .eq("crew_bookings.campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => {
    const booking = row.crew_bookings;
    const personName = booking?.vendors
      ? booking.vendors.contact_name || booking.vendors.company_name
      : booking?.crew_person?.name || "Unknown";

    return {
      ...toCrewPayment(row),
      personName,
      role: booking?.role || "",
      campaignName: booking?.campaigns?.name || "",
      wfNumber: booking?.campaigns?.wf_number || "",
      campaignId: booking?.campaign_id || "",
    };
  });
}

export async function listPendingCrewPayments(): Promise<
  Array<
    CrewPayment & {
      personName: string;
      role: string;
      campaignName: string;
      wfNumber: string;
      campaignId: string;
    }
  >
> {
  const db = createAdminClient();

  const { data, error } = await db
    .from("crew_payments")
    .select(
      "*, crew_bookings!inner(campaign_id, role, vendor_id, user_id, vendors(contact_name, company_name), crew_person:users!crew_bookings_user_id_fkey(name), campaigns(name, wf_number))"
    )
    .eq("status", "Pending Approval")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: any) => {
    const booking = row.crew_bookings;
    const personName = booking?.vendors
      ? booking.vendors.contact_name || booking.vendors.company_name
      : booking?.crew_person?.name || "Unknown";

    return {
      ...toCrewPayment(row),
      personName,
      role: booking?.role || "",
      campaignName: booking?.campaigns?.name || "",
      wfNumber: booking?.campaigns?.wf_number || "",
      campaignId: booking?.campaign_id || "",
    };
  });
}

// --- Mutations ---

export async function createCrewPayment(input: {
  bookingId: string;
  totalDays: number;
  totalAmount: number;
  confirmedBy: string;
  notes?: string;
}): Promise<CrewPayment> {
  const db = createAdminClient();

  // Upsert — if payment already exists for this booking, update it (re-submission)
  const { data, error } = await db
    .from("crew_payments")
    .upsert(
      {
        booking_id: input.bookingId,
        total_days: input.totalDays,
        total_amount: input.totalAmount,
        status: "Pending Approval",
        notes: input.notes || "",
        confirmed_by: input.confirmedBy,
        confirmed_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
        paid_at: null,
      },
      { onConflict: "booking_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return toCrewPayment(data);
}

export async function updateCrewPaymentStatus(
  id: string,
  status: CrewPaymentStatus,
  approvedBy?: string
): Promise<CrewPayment> {
  const db = createAdminClient();

  const updateData: Record<string, unknown> = { status };
  if (approvedBy) {
    updateData.approved_by = approvedBy;
    updateData.approved_at = new Date().toISOString();
  }
  if (status === "Paid") {
    updateData.paid_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from("crew_payments")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toCrewPayment(data);
}
