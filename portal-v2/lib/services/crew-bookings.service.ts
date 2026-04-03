import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CrewBooking,
  CrewBookingDate,
  CrewBookingStatus,
  CrewPayment,
  CrewPaymentStatus,
  RateCard,
  UserRole,
} from "@/types/domain";

// --- Type mappers ---

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

function toCrewBooking(row: Record<string, unknown>): CrewBooking {
  const vendor = row.vendors as Record<string, unknown> | undefined;
  const user = row.crew_person as Record<string, unknown> | undefined;
  const dates = (row.crew_booking_dates as Record<string, unknown>[] | undefined) || [];
  const payments = (row.crew_payments as Record<string, unknown>[] | undefined) || [];

  const mappedDates = dates.map(toCrewBookingDate);
  const plannedDays = mappedDates.length;
  const confirmedDays = mappedDates.filter((d) => d.confirmed === true).length;

  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    vendorId: (row.vendor_id as string) || null,
    userId: (row.user_id as string) || null,
    role: row.role as string,
    dayRate: Number(row.day_rate) || 0,
    classification: row.classification as CrewBooking["classification"],
    status: row.status as CrewBookingStatus,
    bookedBy: row.booked_by as string,
    approvedBy: (row.approved_by as string) || null,
    approvedAt: (row.approved_at as string) || null,
    notes: (row.notes as string) || "",
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
          specialty: (vendor.specialty as string) || "",
          taxId: (vendor.tax_id as string) || "",
          active: vendor.active as boolean,
          onboardedDate: (vendor.onboarded_date as string) || null,
          notes: (vendor.notes as string) || "",
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
    user: user
      ? {
          id: user.id as string,
          email: (user.email as string) || "",
          name: (user.name as string) || "",
          role: user.role as UserRole,
          active: user.active as boolean,
          avatarUrl: (user.avatar_url as string) || "",
          phone: (user.phone as string) || "",
          title: (user.title as string) || "",
          vendorId: (user.vendor_id as string) || null,
          favoriteDrinks: (user.favorite_drinks as string) || "",
          favoriteSnacks: (user.favorite_snacks as string) || "",
          dietaryRestrictions: (user.dietary_restrictions as string) || "",
          allergies: (user.allergies as string) || "",
          energyBoost: (user.energy_boost as string) || "",
          favoritePublixProduct: (user.favorite_publix_product as string) || "",
          lunchPlace: (user.lunch_place as string) || "",
          preferredContact: (user.preferred_contact as string) || "",
          onboardingCompleted: (user.onboarding_completed as boolean) || false,
          createdAt: user.created_at as string,
          updatedAt: user.updated_at as string,
        }
      : undefined,
    dates: mappedDates,
    payment: payments.length > 0 ? toCrewPayment(payments[0]) : undefined,
    plannedDays,
    confirmedDays,
    totalAmount: confirmedDays > 0
      ? confirmedDays * (Number(row.day_rate) || 0)
      : plannedDays * (Number(row.day_rate) || 0),
  };
}

function toCrewBookingDate(row: Record<string, unknown>): CrewBookingDate {
  return {
    id: row.id as string,
    bookingId: row.booking_id as string,
    shootDate: row.shoot_date as string,
    confirmed: row.confirmed as boolean | null,
    confirmedBy: (row.confirmed_by as string) || null,
    confirmedAt: (row.confirmed_at as string) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
  };
}

// --- Crew Bookings ---

// Use FK hint to disambiguate — crew_bookings has 3 FKs to users (user_id, booked_by, approved_by)
const BOOKING_SELECT = "*, vendors!crew_bookings_vendor_id_fkey(*), crew_person:users!crew_bookings_user_id_fkey(*), crew_booking_dates(*), crew_payments(*)";

export async function listAllCrewBookings(): Promise<Array<CrewBooking & { campaignName: string; wfNumber: string }>> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("crew_bookings")
    .select(BOOKING_SELECT + ", campaigns(name, wf_number)")
    .neq("status", "Cancelled")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((row: Record<string, unknown>) => {
    const campaign = row.campaigns as Record<string, unknown> | undefined;
    return {
      ...toCrewBooking(row),
      campaignName: (campaign?.name as string) || "",
      wfNumber: (campaign?.wf_number as string) || "",
    };
  });
}

export async function listCrewBookings(campaignId: string): Promise<CrewBooking[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("crew_bookings")
    .select(BOOKING_SELECT)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map(toCrewBooking);
}

export async function getCrewBooking(id: string): Promise<CrewBooking | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("crew_bookings")
    .select(BOOKING_SELECT)
    .eq("id", id)
    .single();
  if (error) return null;
  return toCrewBooking(data);
}

export async function createCrewBooking(input: {
  campaignId: string;
  vendorId?: string;
  userId?: string;
  role: string;
  dayRate: number;
  classification?: string;
  dates: string[];
  bookedBy: string;
  notes?: string;
}): Promise<CrewBooking> {
  const db = createAdminClient();

  // Check if rate exceeds standard → needs approval
  const { data: rateCard } = await db
    .from("rate_cards")
    .select("day_rate")
    .ilike("role", input.role)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const standardRate = rateCard ? Number(rateCard.day_rate) : null;
  const needsApproval = standardRate !== null && input.dayRate > standardRate * 1.15;

  const { data, error } = await db
    .from("crew_bookings")
    .insert({
      campaign_id: input.campaignId,
      vendor_id: input.vendorId || null,
      user_id: input.userId || null,
      role: input.role,
      day_rate: input.dayRate,
      classification: input.classification || "1099",
      status: needsApproval ? "Pending Approval" : "Confirmed",
      booked_by: input.bookedBy,
      notes: input.notes || "",
    })
    .select(BOOKING_SELECT)
    .single();

  if (error) throw error;

  // Insert booking dates
  if (input.dates.length > 0) {
    const dateRows = input.dates.map((d) => ({
      booking_id: data.id,
      shoot_date: d,
    }));
    const { error: datesErr } = await db
      .from("crew_booking_dates")
      .insert(dateRows);
    if (datesErr) throw datesErr;
  }

  // Re-fetch with dates
  const booking = await getCrewBooking(data.id);
  if (!booking) throw new Error("Failed to fetch created booking");
  return booking;
}

export async function updateCrewBooking(
  id: string,
  input: {
    role?: string;
    dayRate?: number;
    classification?: string;
    notes?: string;
    status?: CrewBookingStatus;
    approvedBy?: string;
  }
): Promise<CrewBooking> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};

  if (input.role !== undefined) updateData.role = input.role;
  if (input.dayRate !== undefined) updateData.day_rate = input.dayRate;
  if (input.classification !== undefined) updateData.classification = input.classification;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.approvedBy !== undefined) {
    updateData.approved_by = input.approvedBy;
    updateData.approved_at = new Date().toISOString();
  }

  const { error } = await db
    .from("crew_bookings")
    .update(updateData)
    .eq("id", id);
  if (error) throw error;

  const booking = await getCrewBooking(id);
  if (!booking) throw new Error("Booking not found");
  return booking;
}

export async function deleteCrewBooking(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("crew_bookings").delete().eq("id", id);
  if (error) throw error;
}

// --- Day Confirmation ---

export async function confirmBookingDates(
  bookingId: string,
  confirmations: { dateId: string; confirmed: boolean }[],
  confirmedBy: string
): Promise<CrewBooking> {
  const db = createAdminClient();

  for (const conf of confirmations) {
    const { error } = await db
      .from("crew_booking_dates")
      .update({
        confirmed: conf.confirmed,
        confirmed_by: confirmedBy,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", conf.dateId)
      .eq("booking_id", bookingId);
    if (error) throw error;
  }

  const booking = await getCrewBooking(bookingId);
  if (!booking) throw new Error("Booking not found");
  return booking;
}

// --- Rate Cards ---

export async function listRateCards(): Promise<RateCard[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("rate_cards")
    .select("*")
    .order("role", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    role: row.role,
    dayRate: Number(row.day_rate),
    notes: row.notes || "",
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createRateCard(input: {
  role: string;
  dayRate: number;
  notes?: string;
  createdBy: string;
}): Promise<RateCard> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("rate_cards")
    .insert({
      role: input.role,
      day_rate: input.dayRate,
      notes: input.notes || "",
      created_by: input.createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    role: data.role,
    dayRate: Number(data.day_rate),
    notes: data.notes || "",
    createdBy: data.created_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function updateRateCard(
  id: string,
  input: { role?: string; dayRate?: number; notes?: string }
): Promise<void> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (input.role !== undefined) updateData.role = input.role;
  if (input.dayRate !== undefined) updateData.day_rate = input.dayRate;
  if (input.notes !== undefined) updateData.notes = input.notes;

  const { error } = await db.from("rate_cards").update(updateData).eq("id", id);
  if (error) throw error;
}

export async function deleteRateCard(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("rate_cards").delete().eq("id", id);
  if (error) throw error;
}

// --- Aggregate: crew labor commitment for a campaign ---

export async function getCrewLaborCommitment(campaignId: string): Promise<{
  totalCommitted: number;
  totalConfirmed: number;
  bookingCount: number;
}> {
  const bookings = await listCrewBookings(campaignId);
  const activeBookings = bookings.filter(
    (b) => b.status !== "Cancelled"
  );

  let totalCommitted = 0;
  let totalConfirmed = 0;

  for (const b of activeBookings) {
    totalCommitted += (b.plannedDays || 0) * b.dayRate;
    totalConfirmed += (b.confirmedDays || 0) * b.dayRate;
  }

  return {
    totalCommitted,
    totalConfirmed,
    bookingCount: activeBookings.length,
  };
}
