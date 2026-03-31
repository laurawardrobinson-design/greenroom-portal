import { createAdminClient } from "@/lib/supabase/admin";
import type { Shoot, ShootDate, ShootCrew, AppUser } from "@/types/domain";
import type { CreateShootInput, UpdateShootInput, ShootDateInput } from "@/lib/validation/campaigns.schema";

function toShoot(
  row: Record<string, unknown>,
  dates: ShootDate[] = [],
  crew: ShootCrew[] = []
): Shoot {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    shootType: row.shoot_type as Shoot["shootType"],
    location: row.location as string,
    notes: row.notes as string,
    sortOrder: Number(row.sort_order) || 0,
    crewVariesByDay: row.crew_varies_by_day as boolean,
    dates,
    crew,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toShootDate(row: Record<string, unknown>): ShootDate {
  return {
    id: row.id as string,
    shootId: row.shoot_id as string,
    shootDate: row.shoot_date as string,
    callTime: (row.call_time as string) || null,
    location: row.location as string,
    notes: row.notes as string,
  };
}

function toShootCrew(row: Record<string, unknown>): ShootCrew {
  const user = row.users as Record<string, unknown> | null;
  return {
    id: row.id as string,
    shootId: row.shoot_id as string,
    userId: row.user_id as string,
    shootDateId: (row.shoot_date_id as string) || null,
    roleOnShoot: row.role_on_shoot as string,
    notes: row.notes as string,
    user: user
      ? {
          id: user.id as string,
          email: user.email as string,
          name: user.name as string,
          role: user.role as AppUser["role"],
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
          preferredContact: (user.preferred_contact as string) || "Email",
          onboardingCompleted: (user.onboarding_completed as boolean) ?? false,
          createdAt: user.created_at as string,
          updatedAt: user.updated_at as string,
        }
      : undefined,
  };
}

// --- Get all shoots for a campaign (with nested dates + crew) ---
export async function getShoots(campaignId: string): Promise<Shoot[]> {
  const db = createAdminClient();

  const { data: shootRows, error: shootError } = await db
    .from("shoots")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });

  if (shootError) throw shootError;
  if (!shootRows || shootRows.length === 0) return [];

  const shootIds = shootRows.map((s) => s.id);

  // Fetch dates and crew in parallel
  const [datesResult, crewResult] = await Promise.all([
    db
      .from("shoot_dates")
      .select("*")
      .in("shoot_id", shootIds)
      .order("shoot_date", { ascending: true }),
    db
      .from("shoot_crew")
      .select("*, users(id, email, name, role, active, avatar_url)")
      .in("shoot_id", shootIds),
  ]);

  if (datesResult.error) throw datesResult.error;
  if (crewResult.error) throw crewResult.error;

  const datesByShoot = new Map<string, ShootDate[]>();
  for (const row of datesResult.data || []) {
    const sid = row.shoot_id;
    if (!datesByShoot.has(sid)) datesByShoot.set(sid, []);
    datesByShoot.get(sid)!.push(toShootDate(row));
  }

  const crewByShoot = new Map<string, ShootCrew[]>();
  for (const row of crewResult.data || []) {
    const sid = row.shoot_id;
    if (!crewByShoot.has(sid)) crewByShoot.set(sid, []);
    crewByShoot.get(sid)!.push(toShootCrew(row));
  }

  return shootRows.map((row) =>
    toShoot(
      row,
      datesByShoot.get(row.id) || [],
      crewByShoot.get(row.id) || []
    )
  );
}

// --- Create a shoot ---
export async function createShoot(input: CreateShootInput): Promise<Shoot> {
  const db = createAdminClient();

  // Get the next sort order
  const { count } = await db
    .from("shoots")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", input.campaignId);

  const { data, error } = await db
    .from("shoots")
    .insert({
      campaign_id: input.campaignId,
      name: input.name,
      shoot_type: input.shootType,
      location: input.location,
      notes: input.notes,
      sort_order: (count || 0),
    })
    .select()
    .single();

  if (error) throw error;

  // Add dates if provided
  let dates: ShootDate[] = [];
  if (input.dates.length > 0) {
    const dateRows = input.dates.map((d) => ({
      shoot_id: data.id,
      shoot_date: d.shootDate,
      call_time: d.callTime || null,
      location: d.location || "",
      notes: d.notes || "",
    }));
    const { data: insertedDates, error: dateError } = await db
      .from("shoot_dates")
      .insert(dateRows)
      .select();
    if (dateError) throw dateError;
    dates = (insertedDates || []).map(toShootDate);
  }

  return toShoot(data, dates, []);
}

// --- Update a shoot ---
export async function updateShoot(
  id: string,
  input: UpdateShootInput
): Promise<Shoot> {
  const db = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.shootType !== undefined) updateData.shoot_type = input.shootType;
  if (input.location !== undefined) updateData.location = input.location;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.crewVariesByDay !== undefined) updateData.crew_varies_by_day = input.crewVariesByDay;

  const { data, error } = await db
    .from("shoots")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;

  // Fetch dates and crew
  const [datesResult, crewResult] = await Promise.all([
    db
      .from("shoot_dates")
      .select("*")
      .eq("shoot_id", id)
      .order("shoot_date", { ascending: true }),
    db
      .from("shoot_crew")
      .select("*, users(id, email, name, role, active, avatar_url)")
      .eq("shoot_id", id),
  ]);

  return toShoot(
    data,
    (datesResult.data || []).map(toShootDate),
    (crewResult.data || []).map(toShootCrew)
  );
}

// --- Delete a shoot ---
export async function deleteShoot(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shoots").delete().eq("id", id);
  if (error) throw error;
}

// --- Add dates to a shoot ---
export async function addShootDates(
  shootId: string,
  dates: ShootDateInput[]
): Promise<ShootDate[]> {
  const db = createAdminClient();
  const rows = dates.map((d) => ({
    shoot_id: shootId,
    shoot_date: d.shootDate,
    call_time: d.callTime || null,
    location: d.location || "",
    notes: d.notes || "",
  }));
  const { data, error } = await db.from("shoot_dates").insert(rows).select();
  if (error) throw error;
  return (data || []).map(toShootDate);
}

// --- Remove a shoot date ---
export async function removeShootDate(dateId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shoot_dates").delete().eq("id", dateId);
  if (error) throw error;
}

// --- Add crew to a shoot ---
export async function addShootCrew(
  shootId: string,
  userId: string,
  roleOnShoot: string,
  notes: string = "",
  shootDateId: string | null = null
): Promise<ShootCrew> {
  const db = createAdminClient();
  const insertData: Record<string, unknown> = {
    shoot_id: shootId,
    user_id: userId,
    role_on_shoot: roleOnShoot,
    notes,
  };
  if (shootDateId) insertData.shoot_date_id = shootDateId;

  const { data, error } = await db
    .from("shoot_crew")
    .insert(insertData)
    .select("*, users(id, email, name, role, active, avatar_url)")
    .single();
  if (error) throw error;
  return toShootCrew(data);
}

// --- Remove crew from a shoot ---
export async function removeShootCrew(crewId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shoot_crew").delete().eq("id", crewId);
  if (error) throw error;
}
