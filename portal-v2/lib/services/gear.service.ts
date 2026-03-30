import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GearItem,
  GearCheckout,
  GearReservation,
  GearKit,
  GearMaintenance,
  GearStatus,
  GearCategory,
  GearCondition,
} from "@/types/domain";

function toGearItem(row: Record<string, unknown>): GearItem {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as GearCategory,
    brand: row.brand as string,
    model: row.model as string,
    serialNumber: row.serial_number as string,
    qrCode: row.qr_code as string,
    rfidTag: (row.rfid_tag as string) || null,
    status: row.status as GearStatus,
    condition: row.condition as GearCondition,
    purchaseDate: (row.purchase_date as string) || null,
    purchasePrice: Number(row.purchase_price) || 0,
    warrantyExpiry: (row.warranty_expiry as string) || null,
    imageUrl: row.image_url as string,
    notes: row.notes as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// --- Gear Items ---
export async function listGearItems(filters?: {
  category?: GearCategory;
  status?: GearStatus;
  search?: string;
  section?: "Gear" | "Props";
}): Promise<GearItem[]> {
  const db = createAdminClient();
  let query = db.from("gear_items").select("*").order("name");

  // Default to 'Gear' section to preserve existing behavior
  query = query.eq("section", filters?.section ?? "Gear");

  if (filters?.category) query = query.eq("category", filters.category);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%,serial_number.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toGearItem);
}

export async function getGearItem(id: string): Promise<GearItem | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("gear_items").select("*").eq("id", id).single();
  if (error) return null;
  return toGearItem(data);
}

export async function getGearItemByQr(qrCode: string): Promise<GearItem | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("gear_items").select("*").eq("qr_code", qrCode).single();
  if (error) return null;
  return toGearItem(data);
}

export async function getGearItemByRfid(rfidTag: string): Promise<GearItem | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("gear_items").select("*").eq("rfid_tag", rfidTag).single();
  if (error) return null;
  return toGearItem(data);
}

export async function createGearItem(input: {
  name: string;
  category: GearCategory | string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
  notes?: string;
  imageUrl?: string;
  section?: "Gear" | "Props";
}): Promise<GearItem> {
  const db = createAdminClient();
  const qrCode = `GR-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data, error } = await db
    .from("gear_items")
    .insert({
      name: input.name,
      category: input.category,
      brand: input.brand || "",
      model: input.model || "",
      serial_number: input.serialNumber || "",
      qr_code: qrCode,
      purchase_date: input.purchaseDate || null,
      purchase_price: input.purchasePrice || 0,
      warranty_expiry: input.warrantyExpiry || null,
      notes: input.notes || "",
      image_url: input.imageUrl || null,
      section: input.section ?? "Gear",
    })
    .select()
    .single();

  if (error) throw error;
  return toGearItem(data);
}

export async function updateGearItem(
  id: string,
  input: Partial<{
    name: string;
    category: GearCategory;
    brand: string;
    model: string;
    serialNumber: string;
    status: GearStatus;
    condition: GearCondition;
    notes: string;
    rfidTag: string | null;
    imageUrl: string | null;
  }>
): Promise<GearItem> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.brand !== undefined) updateData.brand = input.brand;
  if (input.model !== undefined) updateData.model = input.model;
  if (input.serialNumber !== undefined) updateData.serial_number = input.serialNumber;
  if (input.status !== undefined) updateData.status = input.status;
  if (input.condition !== undefined) updateData.condition = input.condition;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if ("rfidTag" in input) updateData.rfid_tag = input.rfidTag ?? null;
  if ("imageUrl" in input) updateData.image_url = input.imageUrl ?? null;

  const { data, error } = await db.from("gear_items").update(updateData).eq("id", id).select().single();
  if (error) throw error;
  return toGearItem(data);
}

// --- Checkout / Checkin (via atomic RPCs) ---
export async function checkoutGear(input: {
  gearItemId: string;
  userId: string;
  campaignId?: string;
  condition: GearCondition;
  notes?: string;
}): Promise<string> {
  const db = createAdminClient();
  const { data, error } = await db.rpc("atomic_checkout", {
    p_gear_item_id: input.gearItemId,
    p_user_id: input.userId,
    p_campaign_id: input.campaignId || null,
    p_condition: input.condition,
    p_notes: input.notes || "",
  });
  if (error) throw error;
  return data as string;
}

export async function checkinGear(input: {
  checkoutId: string;
  condition: GearCondition;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.rpc("atomic_checkin", {
    p_checkout_id: input.checkoutId,
    p_condition: input.condition,
    p_notes: input.notes || "",
  });
  if (error) throw error;
}

// --- Checkouts history ---
export async function getActiveCheckouts(userId?: string): Promise<GearCheckout[]> {
  const db = createAdminClient();
  let query = db
    .from("gear_checkouts")
    .select("*, gear_items(*), users(*)")
    .is("checked_in_at", null)
    .order("checked_out_at", { ascending: false });

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    gearItemId: row.gear_item_id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    checkedOutAt: row.checked_out_at,
    checkedInAt: row.checked_in_at,
    conditionOut: row.condition_out,
    conditionIn: row.condition_in,
    notes: row.notes,
    gearItem: row.gear_items ? toGearItem(row.gear_items) : undefined,
    user: row.users
      ? { id: row.users.id, email: row.users.email, name: row.users.name, role: row.users.role, active: row.users.active, avatarUrl: row.users.avatar_url || "", phone: row.users.phone || "", title: row.users.title || "", vendorId: row.users.vendor_id, createdAt: row.users.created_at, updatedAt: row.users.updated_at }
      : undefined,
  }));
}

// --- Reservations ---
export async function createReservation(input: {
  gearItemId: string;
  userId: string;
  campaignId?: string;
  startDate: string;
  endDate: string;
  notes?: string;
}): Promise<GearReservation> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gear_reservations")
    .insert({
      gear_item_id: input.gearItemId,
      user_id: input.userId,
      campaign_id: input.campaignId || null,
      start_date: input.startDate,
      end_date: input.endDate,
      notes: input.notes || "",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23P01") {
      throw new Error("This item is already reserved for those dates");
    }
    throw error;
  }

  return {
    id: data.id,
    gearItemId: data.gear_item_id,
    userId: data.user_id,
    campaignId: data.campaign_id,
    startDate: data.start_date,
    endDate: data.end_date,
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
  };
}

export async function listReservations(filters?: {
  gearItemId?: string;
  userId?: string;
  upcoming?: boolean;
}): Promise<GearReservation[]> {
  const db = createAdminClient();
  let query = db
    .from("gear_reservations")
    .select("*, gear_items(*)")
    .eq("status", "Confirmed")
    .order("start_date");

  if (filters?.gearItemId) query = query.eq("gear_item_id", filters.gearItemId);
  if (filters?.userId) query = query.eq("user_id", filters.userId);
  if (filters?.upcoming) query = query.gte("end_date", new Date().toISOString().split("T")[0]);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    gearItemId: row.gear_item_id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    gearItem: row.gear_items ? toGearItem(row.gear_items) : undefined,
  }));
}

// --- Gear Kits ---
export async function listKits(userId?: string): Promise<GearKit[]> {
  const db = createAdminClient();
  let query = db.from("gear_kits").select("*, gear_kit_items(*, gear_items(*))").order("name");
  if (userId) query = query.eq("created_by", userId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.created_by,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    items: row.gear_kit_items?.map((ki: Record<string, unknown>) =>
      toGearItem(ki.gear_items as Record<string, unknown>)
    ),
  }));
}

export async function createKit(input: {
  name: string;
  description?: string;
  createdBy: string;
  isFavorite?: boolean;
  itemIds: string[];
}): Promise<GearKit> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gear_kits")
    .insert({
      name: input.name,
      description: input.description || "",
      created_by: input.createdBy,
      is_favorite: input.isFavorite || false,
    })
    .select()
    .single();

  if (error) throw error;

  if (input.itemIds.length > 0) {
    await db.from("gear_kit_items").insert(
      input.itemIds.map((itemId) => ({
        kit_id: data.id,
        gear_item_id: itemId,
      }))
    );
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    createdBy: data.created_by,
    isFavorite: data.is_favorite,
    createdAt: data.created_at,
  };
}

export async function updateKit(
  id: string,
  input: {
    name?: string;
    description?: string;
    isFavorite?: boolean;
    addItemIds?: string[];
    removeItemIds?: string[];
  }
): Promise<void> {
  const db = createAdminClient();

  if (input.name !== undefined || input.description !== undefined || input.isFavorite !== undefined) {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.isFavorite !== undefined) updateData.is_favorite = input.isFavorite;
    const { error } = await db.from("gear_kits").update(updateData).eq("id", id);
    if (error) throw error;
  }

  if (input.addItemIds?.length) {
    const { error } = await db.from("gear_kit_items").insert(
      input.addItemIds.map((itemId) => ({ kit_id: id, gear_item_id: itemId }))
    );
    if (error) throw error;
  }

  if (input.removeItemIds?.length) {
    const { error } = await db
      .from("gear_kit_items")
      .delete()
      .eq("kit_id", id)
      .in("gear_item_id", input.removeItemIds);
    if (error) throw error;
  }
}

export async function deleteKit(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("gear_kits").delete().eq("id", id);
  if (error) throw error;
}

export async function updateMaintenance(
  id: string,
  input: {
    status?: string;
    completedDate?: string;
    notes?: string;
    cost?: number;
  }
): Promise<void> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (input.status !== undefined) updateData.status = input.status;
  if (input.completedDate !== undefined) updateData.completed_date = input.completedDate;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.cost !== undefined) updateData.cost = input.cost;
  const { error } = await db.from("gear_maintenance").update(updateData).eq("id", id);
  if (error) throw error;
}

// --- Batch Checkout / Checkin ---
export interface BatchResult {
  gearItemId: string;
  name: string;
  success: boolean;
  error?: string;
}

export async function batchCheckoutGear(
  items: { gearItemId: string; condition: GearCondition; name?: string }[],
  userId: string,
  campaignId?: string
): Promise<BatchResult[]> {
  // Process all items in parallel — no per-item pre-fetch needed
  const settled = await Promise.allSettled(
    items.map((item) =>
      checkoutGear({
        gearItemId: item.gearItemId,
        userId,
        campaignId,
        condition: item.condition,
      })
    )
  );

  return settled.map((result, i) => ({
    gearItemId: items[i].gearItemId,
    name: items[i].name || items[i].gearItemId,
    success: result.status === "fulfilled",
    error:
      result.status === "rejected"
        ? result.reason instanceof Error
          ? result.reason.message
          : "Failed"
        : undefined,
  }));
}

export async function batchCheckinGear(
  gearItemIds: string[],
  condition: GearCondition
): Promise<BatchResult[]> {
  if (gearItemIds.length === 0) return [];

  // Fetch only the active checkouts for the specific items — not all checkouts
  const db = createAdminClient();
  const { data: checkoutRows } = await db
    .from("gear_checkouts")
    .select("id, gear_item_id, gear_items(name)")
    .is("checked_in_at", null)
    .in("gear_item_id", gearItemIds);

  const checkoutMap = new Map(
    (checkoutRows || []).map((c) => [
      c.gear_item_id as string,
      { id: c.id as string, name: ((c.gear_items as unknown as Record<string, unknown>)?.name as string) || "Unknown" },
    ])
  );

  const settled = await Promise.allSettled(
    gearItemIds.map(async (gearItemId) => {
      const checkout = checkoutMap.get(gearItemId);
      if (!checkout) throw new Error("No active checkout");
      await checkinGear({ checkoutId: checkout.id, condition });
      return checkout;
    })
  );

  return settled.map((result, i) => {
    const gearItemId = gearItemIds[i];
    const checkout = checkoutMap.get(gearItemId);
    return {
      gearItemId,
      name: checkout?.name || "Unknown",
      success: result.status === "fulfilled",
      error:
        result.status === "rejected"
          ? result.reason instanceof Error
            ? result.reason.message
            : "Failed"
          : undefined,
    };
  });
}

// --- Kit Checkout ---
export async function checkoutKit(input: {
  kitId: string;
  userId: string;
  condition: GearCondition;
  campaignId?: string;
}): Promise<{ checkedOut: GearItem[]; alreadyOut: GearItem[] }> {
  const db = createAdminClient();
  const { data: kitItems, error } = await db
    .from("gear_kit_items")
    .select("gear_items(*)")
    .eq("kit_id", input.kitId);

  if (error) throw error;

  const items = (kitItems || []).map((ki: Record<string, unknown>) =>
    toGearItem(ki.gear_items as Record<string, unknown>)
  );

  const checkedOut: GearItem[] = [];
  const alreadyOut: GearItem[] = [];

  for (const item of items) {
    if (item.status !== "Available") {
      alreadyOut.push(item);
      continue;
    }
    try {
      await checkoutGear({
        gearItemId: item.id,
        userId: input.userId,
        condition: input.condition,
        campaignId: input.campaignId,
      });
      checkedOut.push(item);
    } catch {
      alreadyOut.push(item);
    }
  }

  return { checkedOut, alreadyOut };
}

// --- Recent Activity ---
export async function getRecentActivity(limit = 10): Promise<GearCheckout[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("gear_checkouts")
    .select("*, gear_items(*), users(*)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    gearItemId: row.gear_item_id,
    userId: row.user_id,
    campaignId: row.campaign_id,
    checkedOutAt: row.checked_out_at,
    checkedInAt: row.checked_in_at,
    conditionOut: row.condition_out,
    conditionIn: row.condition_in,
    notes: row.notes,
    gearItem: row.gear_items ? toGearItem(row.gear_items) : undefined,
    user: row.users
      ? { id: row.users.id, email: row.users.email, name: row.users.name, role: row.users.role, active: row.users.active, avatarUrl: row.users.avatar_url || "", phone: row.users.phone || "", title: row.users.title || "", vendorId: row.users.vendor_id, createdAt: row.users.created_at, updatedAt: row.users.updated_at }
      : undefined,
  }));
}

// --- Maintenance ---
export async function listMaintenance(gearItemId?: string): Promise<GearMaintenance[]> {
  const db = createAdminClient();
  let query = db.from("gear_maintenance").select("*").order("scheduled_date", { ascending: false });
  if (gearItemId) query = query.eq("gear_item_id", gearItemId);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    gearItemId: row.gear_item_id,
    type: row.type,
    status: row.status,
    description: row.description,
    cost: Number(row.cost) || 0,
    performedBy: row.performed_by,
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date,
    nextDueDate: row.next_due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createMaintenance(input: {
  gearItemId: string;
  type: "Scheduled" | "Repair";
  description: string;
  scheduledDate?: string;
  performedBy?: string;
  cost?: number;
  notes?: string;
}): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("gear_maintenance").insert({
    gear_item_id: input.gearItemId,
    type: input.type,
    description: input.description,
    scheduled_date: input.scheduledDate || null,
    performed_by: input.performedBy || null,
    cost: input.cost || 0,
    notes: input.notes || "",
  });
  if (error) throw error;
}
