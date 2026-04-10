import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WardrobeItem,
  WardrobeCategory,
  WardrobeCondition,
  WardrobeCheckout,
  WardrobeReservation,
} from "@/types/domain";
import type { CreateWardrobeInput, UpdateWardrobeInput } from "@/lib/validation/wardrobe.schema";

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
    status: ((row.status as string) || "Available") as WardrobeItem["status"],
    condition: ((row.condition as string) || "Good") as WardrobeCondition,
    qrCode: (row.qr_code as string) || null,
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toCheckout(row: Record<string, unknown>): WardrobeCheckout {
  const itemData = row.wardrobe_items as Record<string, unknown> | null;
  return {
    id: row.id as string,
    wardrobeItemId: row.wardrobe_item_id as string,
    userId: (row.user_id as string) || null,
    campaignId: (row.campaign_id as string) || null,
    checkedOutAt: row.checked_out_at as string,
    checkedInAt: (row.checked_in_at as string) || null,
    dueDate: (row.due_date as string) || null,
    conditionOut: (row.condition_out as WardrobeCondition) || "Good",
    conditionIn: (row.condition_in as WardrobeCondition) || null,
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    wardrobeItem: itemData ? toWardrobeItem(itemData) : undefined,
    userName: (row.user_name as string) || undefined,
  };
}

function toReservation(row: Record<string, unknown>): WardrobeReservation {
  const itemData = row.wardrobe_items as Record<string, unknown> | null;
  return {
    id: row.id as string,
    wardrobeItemId: row.wardrobe_item_id as string,
    userId: (row.user_id as string) || null,
    campaignId: (row.campaign_id as string) || null,
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    status: (row.status as WardrobeReservation["status"]) || "Confirmed",
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    wardrobeItem: itemData ? toWardrobeItem(itemData) : undefined,
  };
}

// ── Item CRUD ────────────────────────────────────────────────────────────────

export async function listWardrobeItems(filters?: {
  category?: WardrobeCategory;
  search?: string;
  status?: string;
}): Promise<WardrobeItem[]> {
  const db = createAdminClient();
  let query = db.from("wardrobe_items").select("*").order("name", { ascending: true });

  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.search) query = query.ilike("name", `%${filters.search}%`);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => toWardrobeItem(r as Record<string, unknown>));
}

export async function getWardrobeItem(id: string): Promise<WardrobeItem | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("wardrobe_items").select("*").eq("id", id).single();
  if (error) return null;
  return toWardrobeItem(data as Record<string, unknown>);
}

export async function getWardrobeItemByQr(qrCode: string): Promise<WardrobeItem | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_items")
    .select("*")
    .eq("qr_code", qrCode)
    .maybeSingle();
  if (error || !data) return null;
  return toWardrobeItem(data as Record<string, unknown>);
}

export async function createWardrobeItem(
  input: CreateWardrobeInput,
  userId: string
): Promise<WardrobeItem> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_items")
    .insert({
      name: input.name,
      category: input.category,
      description: input.description,
      shooting_notes: input.shootingNotes,
      restrictions: input.restrictions,
      guide_url: input.guideUrl,
      image_url: input.imageUrl,
      qr_code: input.qrCode || null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return toWardrobeItem(data as Record<string, unknown>);
}

export async function updateWardrobeItem(
  id: string,
  input: UpdateWardrobeInput
): Promise<WardrobeItem> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.category !== undefined) update.category = input.category;
  if (input.description !== undefined) update.description = input.description;
  if (input.shootingNotes !== undefined) update.shooting_notes = input.shootingNotes;
  if (input.restrictions !== undefined) update.restrictions = input.restrictions;
  if (input.guideUrl !== undefined) update.guide_url = input.guideUrl;
  if (input.imageUrl !== undefined) update.image_url = input.imageUrl;
  if (input.qrCode !== undefined) update.qr_code = input.qrCode;

  const { data, error } = await db
    .from("wardrobe_items")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toWardrobeItem(data as Record<string, unknown>);
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("wardrobe_items").delete().eq("id", id);
  if (error) throw error;
}

// ── Checkout ─────────────────────────────────────────────────────────────────

export async function checkoutWardrobeItem(params: {
  wardrobeItemId: string;
  userId: string;
  campaignId?: string;
  condition?: WardrobeCondition;
  notes?: string;
  dueDate?: string;
}): Promise<string> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("wardrobe_atomic_checkout", {
    p_wardrobe_item_id: params.wardrobeItemId,
    p_user_id: params.userId,
    p_campaign_id: params.campaignId ?? null,
    p_condition: params.condition ?? "Good",
    p_notes: params.notes ?? "",
    p_due_date: params.dueDate ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function checkinWardrobeItem(params: {
  checkoutId: string;
  condition?: WardrobeCondition;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.rpc("wardrobe_atomic_checkin", {
    p_checkout_id: params.checkoutId,
    p_condition: params.condition ?? "Good",
    p_notes: params.notes ?? "",
  });
  if (error) throw error;
}

export async function checkinWardrobeItemByItemId(params: {
  wardrobeItemId: string;
  condition?: WardrobeCondition;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { data: checkout, error: findErr } = await db
    .from("wardrobe_checkouts")
    .select("id")
    .eq("wardrobe_item_id", params.wardrobeItemId)
    .is("checked_in_at", null)
    .maybeSingle();
  if (findErr || !checkout) throw new Error("No active checkout found for this item");
  await checkinWardrobeItem({ checkoutId: checkout.id, ...params });
}

export async function batchCheckoutWardrobe(
  items: { wardrobeItemId: string; condition?: WardrobeCondition }[],
  userId: string,
  campaignId?: string,
  dueDate?: string
): Promise<{ wardrobeItemId: string; success: boolean; error?: string }[]> {
  const results = await Promise.allSettled(
    items.map((item) =>
      checkoutWardrobeItem({
        wardrobeItemId: item.wardrobeItemId,
        userId,
        campaignId,
        condition: item.condition ?? "Good",
        dueDate,
      })
    )
  );
  return results.map((r, i) => ({
    wardrobeItemId: items[i].wardrobeItemId,
    success: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}

export async function batchCheckinWardrobe(
  wardrobeItemIds: string[],
  condition: WardrobeCondition = "Good"
): Promise<{ wardrobeItemId: string; success: boolean; error?: string }[]> {
  const results = await Promise.allSettled(
    wardrobeItemIds.map((id) => checkinWardrobeItemByItemId({ wardrobeItemId: id, condition }))
  );
  return results.map((r, i) => ({
    wardrobeItemId: wardrobeItemIds[i],
    success: r.status === "fulfilled",
    error: r.status === "rejected" ? String(r.reason) : undefined,
  }));
}

export async function getActiveWardrobeCheckouts(): Promise<WardrobeCheckout[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("wardrobe_checkouts")
    .select("*, wardrobe_items(*)")
    .is("checked_in_at", null)
    .order("checked_out_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => toCheckout(r as Record<string, unknown>));
}

// ── Reservations ─────────────────────────────────────────────────────────────

export async function listWardrobeReservations(filters?: {
  wardrobeItemId?: string;
  upcoming?: boolean;
}): Promise<WardrobeReservation[]> {
  const db = createAdminClient();
  let query = db
    .from("wardrobe_reservations")
    .select("*, wardrobe_items(*)")
    .eq("status", "Confirmed")
    .order("start_date", { ascending: true });

  if (filters?.wardrobeItemId) query = query.eq("wardrobe_item_id", filters.wardrobeItemId);
  if (filters?.upcoming) query = query.gte("end_date", new Date().toISOString().split("T")[0]);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => toReservation(r as Record<string, unknown>));
}

export async function createWardrobeReservation(params: {
  wardrobeItemId: string;
  userId: string;
  startDate: string;
  endDate: string;
  campaignId?: string;
  notes?: string;
}): Promise<WardrobeReservation> {
  const db = createAdminClient();

  // Check for overlapping confirmed reservations
  const { data: overlaps } = await db
    .from("wardrobe_reservations")
    .select("id")
    .eq("wardrobe_item_id", params.wardrobeItemId)
    .eq("status", "Confirmed")
    .lte("start_date", params.endDate)
    .gte("end_date", params.startDate);

  if (overlaps && overlaps.length > 0) {
    throw new Error("Item already reserved for those dates");
  }

  const { data, error } = await db
    .from("wardrobe_reservations")
    .insert({
      wardrobe_item_id: params.wardrobeItemId,
      user_id: params.userId,
      start_date: params.startDate,
      end_date: params.endDate,
      campaign_id: params.campaignId ?? null,
      notes: params.notes ?? "",
    })
    .select("*, wardrobe_items(*)")
    .single();

  if (error) throw error;

  // Update item status to Reserved
  await db
    .from("wardrobe_items")
    .update({ status: "Reserved" })
    .eq("id", params.wardrobeItemId)
    .eq("status", "Available");

  return toReservation(data as Record<string, unknown>);
}

export async function cancelWardrobeReservation(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: res, error: findErr } = await db
    .from("wardrobe_reservations")
    .select("wardrobe_item_id")
    .eq("id", id)
    .single();
  if (findErr) throw findErr;

  const { error } = await db
    .from("wardrobe_reservations")
    .update({ status: "Cancelled" })
    .eq("id", id);
  if (error) throw error;

  // If no other active reservations, set status back to Available
  const { data: others } = await db
    .from("wardrobe_reservations")
    .select("id")
    .eq("wardrobe_item_id", res.wardrobe_item_id)
    .eq("status", "Confirmed");

  if (!others || others.length === 0) {
    await db
      .from("wardrobe_items")
      .update({ status: "Available" })
      .eq("id", res.wardrobe_item_id)
      .eq("status", "Reserved");
  }
}
