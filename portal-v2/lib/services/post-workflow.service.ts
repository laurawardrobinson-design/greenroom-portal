import { createClient } from "@/lib/supabase/server";
import type {
  EditRoom,
  EditRoomReservation,
  MediaDrive,
  DriveCheckoutSession,
  DriveCheckoutItem,
  DriveReservation,
  PostWorkflowSummary,
} from "@/types/domain";
import { differenceInDays, parseISO } from "date-fns";

// ─── helpers ─────────────────────────────────────────────────────────────────

function toEditRoom(row: any): EditRoom {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? null,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function toReservation(row: any): EditRoomReservation {
  return {
    id: row.id,
    roomId: row.room_id,
    roomName: row.edit_rooms?.name ?? null,
    campaignId: row.campaign_id ?? null,
    campaignWfNumber: row.campaigns?.wf_number ?? null,
    campaignName: row.campaigns?.name ?? null,
    editorName: row.editor_name,
    editorUserId: row.editor_user_id ?? null,
    reservedDate: row.reserved_date,
    groupId: row.group_id,
    status: row.status,
    notes: row.notes ?? null,
    reservedBy: row.reserved_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function retirementFlags(retirementDate: string | null) {
  if (!retirementDate) return { nearingRetirement: false, pastRetirement: false };
  const days = differenceInDays(parseISO(retirementDate), new Date());
  return {
    nearingRetirement: days >= 0 && days <= 90,
    pastRetirement: days < 0,
  };
}

function toDrive(row: any): MediaDrive {
  const flags = retirementFlags(row.retirement_date);
  return {
    id: row.id,
    brand: row.brand,
    model: row.model ?? null,
    storageSize: row.storage_size,
    driveType: row.drive_type,
    purchaseDate: row.purchase_date ?? null,
    retirementDate: row.retirement_date ?? null,
    condition: row.condition,
    status: row.status,
    location: row.location,
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedToUserName: row.users?.name ?? null,
    isPermanentlyAssigned: row.is_permanently_assigned,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...flags,
  };
}

function toCheckoutItem(row: any): DriveCheckoutItem {
  return {
    id: row.id,
    sessionId: row.session_id,
    driveId: row.drive_id,
    drive: row.media_drives ? toDrive(row.media_drives) : undefined,
    checkoutRole: row.checkout_role,
    conditionOut: row.condition_out ?? null,
    conditionIn: row.condition_in ?? null,
    actualReturnDate: row.actual_return_date ?? null,
    dataOffloadedBackedUp: row.data_offloaded_backed_up,
    backupLocation: row.backup_location ?? null,
    driveWiped: row.drive_wiped,
    clearForReuse: row.clear_for_reuse,
    returnedAt: row.returned_at ?? null,
    notes: row.notes ?? null,
  };
}

function toSession(row: any): DriveCheckoutSession {
  return {
    id: row.id,
    campaignId: row.campaign_id ?? null,
    projectDisplayName: row.project_display_name ?? null,
    shootDate: row.shoot_date ?? null,
    checkoutDate: row.checkout_date,
    expectedReturnDate: row.expected_return_date ?? null,
    checkedOutBy: row.checked_out_by ?? null,
    checkedOutByName: row.users?.name ?? null,
    status: row.status,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: row.drive_checkout_items?.map(toCheckoutItem) ?? [],
    campaign: row.campaigns
      ? {
          id: row.campaigns.id,
          wfNumber: row.campaigns.wf_number,
          name: row.campaigns.name,
          brand: row.campaigns.brand ?? null,
        }
      : null,
  };
}

// ─── Edit Rooms ───────────────────────────────────────────────────────────────

export async function listEditRooms(): Promise<EditRoom[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edit_rooms")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map(toEditRoom);
}

export async function listEditRoomReservations(from: string, to: string): Promise<EditRoomReservation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("edit_room_reservations")
    .select("*, edit_rooms(name), campaigns(wf_number, name)")
    .gte("reserved_date", from)
    .lte("reserved_date", to)
    .eq("status", "confirmed")
    .order("reserved_date");
  if (error) throw error;
  return (data ?? []).map(toReservation);
}

export async function createEditRoomReservations(input: {
  roomId: string;
  campaignId?: string | null;
  editorName: string;
  editorUserId?: string | null;
  startDate: string;
  endDate: string;
  notes?: string | null;
  reservedBy: string;
}): Promise<EditRoomReservation[]> {
  const supabase = await createClient();

  // Build one record per day between startDate and endDate (inclusive)
  const groupId = crypto.randomUUID();
  const rows: any[] = [];
  const start = parseISO(input.startDate);
  const end = parseISO(input.endDate);
  let cur = new Date(start);
  while (cur <= end) {
    rows.push({
      room_id: input.roomId,
      campaign_id: input.campaignId ?? null,
      editor_name: input.editorName,
      editor_user_id: input.editorUserId ?? null,
      reserved_date: cur.toISOString().split("T")[0],
      group_id: groupId,
      status: "confirmed",
      notes: input.notes ?? null,
      reserved_by: input.reservedBy,
    });
    cur.setDate(cur.getDate() + 1);
  }

  const { data, error } = await supabase
    .from("edit_room_reservations")
    .insert(rows)
    .select("*, edit_rooms(name), campaigns(wf_number, name)");
  if (error) throw error;
  return (data ?? []).map(toReservation);
}

export async function cancelEditRoomReservationGroup(groupId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("edit_room_reservations")
    .update({ status: "cancelled" })
    .eq("group_id", groupId);
  if (error) throw error;
}

export async function updateEditRoomReservationGroup(
  groupId: string,
  updates: { editorName?: string; campaignId?: string | null; notes?: string | null }
): Promise<void> {
  const supabase = await createClient();
  const patch: any = {};
  if (updates.editorName !== undefined) patch.editor_name = updates.editorName;
  if (updates.campaignId !== undefined) patch.campaign_id = updates.campaignId;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  const { error } = await supabase
    .from("edit_room_reservations")
    .update(patch)
    .eq("group_id", groupId);
  if (error) throw error;
}

// ─── Media Drives ─────────────────────────────────────────────────────────────

export async function listMediaDrives(filters?: {
  status?: string;
  storageSize?: string;
  search?: string;
}): Promise<MediaDrive[]> {
  const supabase = await createClient();
  let q = supabase
    .from("media_drives")
    .select("*, users(name)")
    .order("brand")
    .order("storage_size");

  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.storageSize) q = q.eq("storage_size", filters.storageSize);
  if (filters?.search) q = q.or(`brand.ilike.%${filters.search}%,model.ilike.%${filters.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toDrive);
}

export async function getMediaDrive(id: string): Promise<MediaDrive | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_drives")
    .select("*, users(name)")
    .eq("id", id)
    .single();
  if (error) return null;
  return toDrive(data);
}

export async function createMediaDrive(input: Partial<MediaDrive>): Promise<MediaDrive> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_drives")
    .insert({
      brand: input.brand,
      model: input.model ?? null,
      storage_size: input.storageSize,
      drive_type: input.driveType,
      purchase_date: input.purchaseDate ?? null,
      condition: input.condition ?? "Good",
      status: input.status ?? "Available",
      location: input.location ?? "Corporate",
      assigned_to_user_id: input.assignedToUserId ?? null,
      is_permanently_assigned: input.isPermanentlyAssigned ?? false,
      notes: input.notes ?? null,
    })
    .select("*, users(name)")
    .single();
  if (error) throw error;
  return toDrive(data);
}

export async function updateMediaDrive(id: string, input: Partial<MediaDrive>): Promise<MediaDrive> {
  const supabase = await createClient();
  const patch: any = {};
  if (input.brand !== undefined) patch.brand = input.brand;
  if (input.model !== undefined) patch.model = input.model;
  if (input.storageSize !== undefined) patch.storage_size = input.storageSize;
  if (input.driveType !== undefined) patch.drive_type = input.driveType;
  if (input.purchaseDate !== undefined) patch.purchase_date = input.purchaseDate;
  if (input.condition !== undefined) patch.condition = input.condition;
  if (input.status !== undefined) patch.status = input.status;
  if (input.location !== undefined) patch.location = input.location;
  if (input.assignedToUserId !== undefined) patch.assigned_to_user_id = input.assignedToUserId;
  if (input.isPermanentlyAssigned !== undefined) patch.is_permanently_assigned = input.isPermanentlyAssigned;
  if (input.notes !== undefined) patch.notes = input.notes;

  const { data, error } = await supabase
    .from("media_drives")
    .update(patch)
    .eq("id", id)
    .select("*, users(name)")
    .single();
  if (error) throw error;
  return toDrive(data);
}

// Suggest a pair of available drives for checkout.
// Prefers same brand; falls back to any brand combination.
export async function suggestDrivePair(storageSize: string): Promise<MediaDrive[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("media_drives")
    .select("*, users(name)")
    .eq("status", "Available")
    .eq("storage_size", storageSize)
    .order("brand");
  if (error) throw error;
  const available = (data ?? []).map(toDrive);
  if (available.length < 2) return available;

  // Group by brand
  const byBrand = new Map<string, MediaDrive[]>();
  for (const d of available) {
    const key = d.brand;
    if (!byBrand.has(key)) byBrand.set(key, []);
    byBrand.get(key)!.push(d);
  }

  // Prefer same brand if 2+ available
  for (const [, drives] of byBrand) {
    if (drives.length >= 2) return [drives[0], drives[1]];
  }

  // Otherwise return any two
  return [available[0], available[1]];
}

// ─── Drive Checkout Sessions ──────────────────────────────────────────────────

export async function listDriveCheckoutSessions(filters?: {
  status?: string;
}): Promise<DriveCheckoutSession[]> {
  const supabase = await createClient();
  let q = supabase
    .from("drive_checkout_sessions")
    .select(
      "*, users(name), campaigns(id, wf_number, name, brand), drive_checkout_items(*, media_drives(*, users(name)))"
    )
    .order("checkout_date", { ascending: false });

  if (filters?.status) q = q.eq("status", filters.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toSession);
}

export async function createDriveCheckoutSession(input: {
  campaignId?: string | null;
  projectDisplayName?: string | null;
  shootDate?: string | null;
  expectedReturnDate?: string | null;
  checkedOutBy: string;
  notes?: string | null;
  drives: Array<{ driveId: string; role: "shooter" | "media_manager"; conditionOut: string }>;
}): Promise<DriveCheckoutSession> {
  const supabase = await createClient();

  // Build campaign display name if not provided
  let displayName = input.projectDisplayName ?? null;
  if (!displayName && input.campaignId) {
    const { data: camp } = await supabase
      .from("campaigns")
      .select("wf_number, name")
      .eq("id", input.campaignId)
      .single();
    if (camp) displayName = `${camp.wf_number} ${camp.name}`;
  }

  const { data: session, error: sessionErr } = await supabase
    .from("drive_checkout_sessions")
    .insert({
      campaign_id: input.campaignId ?? null,
      project_display_name: displayName,
      shoot_date: input.shootDate ?? null,
      expected_return_date: input.expectedReturnDate ?? null,
      checked_out_by: input.checkedOutBy,
      status: "active",
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (sessionErr) throw sessionErr;

  // Insert checkout items
  const items = input.drives.map((d) => ({
    session_id: session.id,
    drive_id: d.driveId,
    checkout_role: d.role,
    condition_out: d.conditionOut,
  }));
  const { error: itemsErr } = await supabase.from("drive_checkout_items").insert(items);
  if (itemsErr) throw itemsErr;

  // Mark both drives as Checked Out
  const driveIds = input.drives.map((d) => d.driveId);
  const { error: driveErr } = await supabase
    .from("media_drives")
    .update({ status: "Checked Out" })
    .in("id", driveIds);
  if (driveErr) throw driveErr;

  // Fetch full session with items
  const { data: full, error: fetchErr } = await supabase
    .from("drive_checkout_sessions")
    .select(
      "*, users(name), campaigns(id, wf_number, name, brand), drive_checkout_items(*, media_drives(*, users(name)))"
    )
    .eq("id", session.id)
    .single();
  if (fetchErr) throw fetchErr;
  return toSession(full);
}

/** Process return for one item in a session (phase 1 = media_manager, phase 2 = shooter). */
export async function processDriveReturn(
  itemId: string,
  sessionId: string,
  patch: {
    conditionIn: string;
    actualReturnDate: string;
    dataOffloadedBackedUp?: boolean;
    backupLocation?: string | null;
    driveWiped?: boolean;
    clearForReuse?: boolean;
    notes?: string | null;
  }
): Promise<void> {
  const supabase = await createClient();

  // Update the checkout item
  const { data: item, error: itemErr } = await supabase
    .from("drive_checkout_items")
    .update({
      condition_in: patch.conditionIn,
      actual_return_date: patch.actualReturnDate,
      data_offloaded_backed_up: patch.dataOffloadedBackedUp ?? false,
      backup_location: patch.backupLocation ?? null,
      drive_wiped: patch.driveWiped ?? false,
      clear_for_reuse: patch.clearForReuse ?? false,
      returned_at: new Date().toISOString(),
      notes: patch.notes ?? null,
    })
    .eq("id", itemId)
    .select("drive_id, checkout_role, drive_wiped, data_offloaded_backed_up")
    .single();
  if (itemErr) throw itemErr;

  // Update drive status based on what was returned
  let newStatus: string;
  if (item.checkout_role === "media_manager") {
    // Media manager drive returned + backup confirmed → ready for pickup/wipe
    newStatus = "Pending Backup/Wipe";
  } else {
    // Shooter drive returned after wipe → back to available
    newStatus = item.drive_wiped ? "Available" : "Pending Backup/Wipe";
  }
  await supabase.from("media_drives").update({ status: newStatus }).eq("id", item.drive_id);

  // Update session status: check if all items returned
  const { data: allItems } = await supabase
    .from("drive_checkout_items")
    .select("returned_at")
    .eq("session_id", sessionId);

  const allReturned = (allItems ?? []).every((i) => i.returned_at !== null);
  const anyReturned = (allItems ?? []).some((i) => i.returned_at !== null);

  await supabase
    .from("drive_checkout_sessions")
    .update({ status: allReturned ? "completed" : anyReturned ? "partial_return" : "active" })
    .eq("id", sessionId);
}

// ─── Summary (for dashboard) ──────────────────────────────────────────────────

export async function getPostWorkflowSummary(): Promise<PostWorkflowSummary> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [roomsRes, drivesRes] = await Promise.all([
    supabase
      .from("edit_room_reservations")
      .select("id", { count: "exact" })
      .eq("reserved_date", today)
      .eq("status", "confirmed"),
    supabase
      .from("media_drives")
      .select("id, brand, model, storage_size, status, retirement_date"),
  ]);

  const editRoomsBookedToday = roomsRes.count ?? 0;
  const drives = drivesRes.data ?? [];

  let drivesCheckedOut = 0;
  let drivesPendingBackup = 0;
  let drivesNearingRetirement = 0;
  let drivesPastRetirement = 0;
  const retirementAlerts: PostWorkflowSummary["retirementAlerts"] = [];

  for (const d of drives) {
    if (d.status === "Checked Out") drivesCheckedOut++;
    if (d.status === "Pending Backup/Wipe") drivesPendingBackup++;

    const flags = retirementFlags(d.retirement_date);
    if (flags.pastRetirement) {
      drivesPastRetirement++;
      retirementAlerts.push({
        id: d.id,
        brand: d.brand,
        model: d.model ?? null,
        storageSize: d.storage_size,
        retirementDate: d.retirement_date,
        pastRetirement: true,
      });
    } else if (flags.nearingRetirement) {
      drivesNearingRetirement++;
      retirementAlerts.push({
        id: d.id,
        brand: d.brand,
        model: d.model ?? null,
        storageSize: d.storage_size,
        retirementDate: d.retirement_date,
        pastRetirement: false,
      });
    }
  }

  // Sort alerts: past retirement first, then by date ascending
  retirementAlerts.sort((a, b) => {
    if (a.pastRetirement !== b.pastRetirement) return a.pastRetirement ? -1 : 1;
    return a.retirementDate.localeCompare(b.retirementDate);
  });

  return {
    editRoomsBookedToday,
    drivesCheckedOut,
    drivesPendingBackup,
    drivesNearingRetirement,
    drivesPastRetirement,
    retirementAlerts,
  };
}
