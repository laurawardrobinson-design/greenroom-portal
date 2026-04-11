import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WardrobeUnit,
  WardrobeItem,
  WardrobeCategory,
  WardrobeCondition,
  WardrobeStatus,
  UnitSize,
  UnitGender,
} from "@/types/domain";

// ── Mapping helpers ───────────────────────────────────────────────────────────

function toWardrobeItem(row: Record<string, unknown>): WardrobeItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as WardrobeCategory,
    description: (row.description as string) || "",
    shootingNotes: (row.shooting_notes as string) || "",
    restrictions: (row.restrictions as string) || "",
    guideUrl: (row.guide_url as string) || null,
    imageUrl: (row.image_url as string) || null,
    status: ((row.status as string) || "Available") as WardrobeStatus,
    condition: ((row.condition as string) || "Good") as WardrobeCondition,
    qrCode: (row.qr_code as string) || null,
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toWardrobeUnit(row: Record<string, unknown>): WardrobeUnit {
  const itemData = row.wardrobe_items as Record<string, unknown> | null;
  return {
    id: row.id as string,
    wardrobeItemId: row.wardrobe_item_id as string,
    size: (row.size as UnitSize) || "One Size",
    gender: (row.gender as UnitGender) || "Unisex",
    status: ((row.status as string) || "Available") as WardrobeStatus,
    condition: ((row.condition as string) || "Good") as WardrobeCondition,
    qrCode: (row.qr_code as string) || null,
    notes: (row.notes as string) || "",
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    wardrobeItem: itemData ? toWardrobeItem(itemData) : undefined,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function listWardrobeUnits(filters?: {
  wardrobeItemId?: string;
  size?: string;
  gender?: string;
  status?: string;
}): Promise<WardrobeUnit[]> {
  const db = createAdminClient();
  let query = db
    .from("wardrobe_units")
    .select("*, wardrobe_items(*)")
    .order("wardrobe_item_id", { ascending: true })
    .order("gender", { ascending: true })
    .order("size", { ascending: true });

  if (filters?.wardrobeItemId) query = query.eq("wardrobe_item_id", filters.wardrobeItemId);
  if (filters?.size) query = query.eq("size", filters.size);
  if (filters?.gender) query = query.eq("gender", filters.gender);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => toWardrobeUnit(r as Record<string, unknown>));
}

export async function getWardrobeUnit(id: string): Promise<WardrobeUnit | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_units")
    .select("*, wardrobe_items(*)")
    .eq("id", id)
    .single();
  if (error) return null;
  return toWardrobeUnit(data as Record<string, unknown>);
}

export async function getWardrobeUnitByQr(qrCode: string): Promise<WardrobeUnit | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_units")
    .select("*, wardrobe_items(*)")
    .eq("qr_code", qrCode)
    .single();
  if (error) return null;
  return toWardrobeUnit(data as Record<string, unknown>);
}

export async function createWardrobeUnit(
  input: {
    wardrobeItemId: string;
    size?: UnitSize;
    gender?: UnitGender;
    condition?: WardrobeCondition;
    qrCode?: string | null;
    notes?: string;
    quantity?: number; // batch create — creates N identical units
  },
  userId: string
): Promise<WardrobeUnit[]> {
  const db = createAdminClient();
  const qty = Math.max(1, Math.min(input.quantity ?? 1, 50));

  const rows = Array.from({ length: qty }, () => ({
    wardrobe_item_id: input.wardrobeItemId,
    size: input.size ?? "One Size",
    gender: input.gender ?? "Unisex",
    condition: input.condition ?? "Good",
    qr_code: qty === 1 ? (input.qrCode ?? null) : null, // only set QR for single unit
    notes: input.notes ?? "",
    created_by: userId,
  }));

  const { data, error } = await db
    .from("wardrobe_units")
    .insert(rows)
    .select("*, wardrobe_items(*)");
  if (error) {
    if (error.code === "23505") throw new Error("QR code already in use on another unit");
    throw error;
  }
  return (data || []).map((r) => toWardrobeUnit(r as Record<string, unknown>));
}

export async function updateWardrobeUnit(
  id: string,
  input: Partial<{
    size: UnitSize;
    gender: UnitGender;
    status: WardrobeStatus;
    condition: WardrobeCondition;
    qrCode: string | null;
    notes: string;
  }>
): Promise<WardrobeUnit> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.size !== undefined) update.size = input.size;
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.status !== undefined) update.status = input.status;
  if (input.condition !== undefined) update.condition = input.condition;
  if (input.qrCode !== undefined) update.qr_code = input.qrCode;
  if (input.notes !== undefined) update.notes = input.notes;

  const { data, error } = await db
    .from("wardrobe_units")
    .update(update)
    .eq("id", id)
    .select("*, wardrobe_items(*)")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("QR code already in use on another unit");
    throw error;
  }
  return toWardrobeUnit(data as Record<string, unknown>);
}

export async function deleteWardrobeUnit(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("wardrobe_units").delete().eq("id", id);
  if (error) throw error;
}

// ── Checkout / Checkin (via atomic RPCs) ─────────────────────────────────────

export async function checkoutUnit(params: {
  unitId: string;
  userId: string;
  campaignId?: string;
  condition?: WardrobeCondition;
  notes?: string;
  dueDate?: string;
}): Promise<string> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("unit_atomic_checkout", {
    p_unit_id: params.unitId,
    p_user_id: params.userId,
    p_campaign_id: params.campaignId ?? null,
    p_condition: params.condition ?? "Good",
    p_notes: params.notes ?? "",
    p_due_date: params.dueDate ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function checkinUnit(params: {
  checkoutId: string;
  condition?: WardrobeCondition;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.rpc("unit_atomic_checkin", {
    p_checkout_id: params.checkoutId,
    p_condition: params.condition ?? "Good",
    p_notes: params.notes ?? "",
  });
  if (error) throw new Error(error.message);
}

export async function getActiveUnitCheckouts(): Promise<
  Array<{
    id: string;
    wardrobeUnitId: string;
    userId: string | null;
    campaignId: string | null;
    checkedOutAt: string;
    dueDate: string | null;
    conditionOut: WardrobeCondition;
    notes: string;
    wardrobeUnit?: WardrobeUnit;
  }>
> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_checkouts")
    .select("*, wardrobe_units(*, wardrobe_items(*))")
    .is("checked_in_at", null)
    .not("wardrobe_unit_id", "is", null)
    .order("checked_out_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => {
    const r = row as Record<string, unknown>;
    const unitData = r.wardrobe_units as Record<string, unknown> | null;
    return {
      id: r.id as string,
      wardrobeUnitId: r.wardrobe_unit_id as string,
      userId: (r.user_id as string) || null,
      campaignId: (r.campaign_id as string) || null,
      checkedOutAt: r.checked_out_at as string,
      dueDate: (r.due_date as string) || null,
      conditionOut: (r.condition_out as WardrobeCondition) || "Good",
      notes: (r.notes as string) || "",
      wardrobeUnit: unitData ? toWardrobeUnit(unitData) : undefined,
    };
  });
}

// ── Unit Reservations ─────────────────────────────────────────────────────────

export async function createUnitReservation(params: {
  wardrobeUnitId: string;
  userId: string;
  campaignId?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();

  // Check for overlap on this unit
  const { data: overlapping } = await db
    .from("wardrobe_reservations")
    .select("id")
    .eq("wardrobe_unit_id", params.wardrobeUnitId)
    .eq("status", "Confirmed")
    .lte("start_date", params.endDate)
    .gte("end_date", params.startDate);

  if (overlapping && overlapping.length > 0) {
    throw new Error("This unit already has a confirmed reservation for those dates");
  }

  const { error } = await db.from("wardrobe_reservations").insert({
    wardrobe_unit_id: params.wardrobeUnitId,
    wardrobe_item_id: null,
    user_id: params.userId,
    campaign_id: params.campaignId ?? null,
    start_date: params.startDate,
    end_date: params.endDate,
    status: "Confirmed",
    notes: params.notes ?? "",
  });
  if (error) throw error;

  // Update unit status to Reserved
  await db
    .from("wardrobe_units")
    .update({ status: "Reserved" })
    .eq("id", params.wardrobeUnitId)
    .eq("status", "Available");
}

export async function cancelUnitReservation(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: res } = await db
    .from("wardrobe_reservations")
    .select("wardrobe_unit_id")
    .eq("id", id)
    .single();

  await db
    .from("wardrobe_reservations")
    .update({ status: "Cancelled" })
    .eq("id", id);

  if (res?.wardrobe_unit_id) {
    // Only reset to Available if no other active reservations
    const { data: others } = await db
      .from("wardrobe_reservations")
      .select("id")
      .eq("wardrobe_unit_id", res.wardrobe_unit_id)
      .eq("status", "Confirmed");

    if (!others || others.length === 0) {
      await db
        .from("wardrobe_units")
        .update({ status: "Available" })
        .eq("id", res.wardrobe_unit_id)
        .eq("status", "Reserved");
    }
  }
}
