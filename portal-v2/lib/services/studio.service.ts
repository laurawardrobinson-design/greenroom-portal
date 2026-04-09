import { createAdminClient } from "@/lib/supabase/admin";
import type {
  StudioSpace,
  SpaceReservation,
  ShootMeal,
  MealType,
  MealLocation,
  MealStatus,
  MealHandlerRole,
} from "@/types/domain";

const db = () => createAdminClient();

// ─────────────────────────────────────────────
// Spaces
// ─────────────────────────────────────────────

export async function listSpaces(): Promise<StudioSpace[]> {
  const { data, error } = await db()
    .from("studio_spaces")
    .select("*")
    .order("sort_order");

  if (error) throw error;
  return (data ?? []).map(mapSpace);
}

function mapSpace(r: Record<string, unknown>): StudioSpace {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as StudioSpace["type"],
    capacity: r.capacity as number | null,
    notes: r.notes as string | null,
    sortOrder: r.sort_order as number,
  };
}

// ─────────────────────────────────────────────
// Space Reservations
// ─────────────────────────────────────────────

export async function listReservations(opts: {
  campaignId?: string;
  spaceId?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<SpaceReservation[]> {
  let q = db()
    .from("space_reservations")
    .select(`
      *,
      space:studio_spaces(id, name, type, sort_order),
      campaign:campaigns(id, wf_number, name),
      reserved_by_user:users!space_reservations_reserved_by_fkey(id, name)
    `)
    .order("reserved_date")
    .order("start_time");

  if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
  if (opts.spaceId)    q = q.eq("space_id", opts.spaceId);
  if (opts.dateFrom)   q = q.gte("reserved_date", opts.dateFrom);
  if (opts.dateTo)     q = q.lte("reserved_date", opts.dateTo);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapReservation);
}

export async function createReservation(input: {
  campaignId: string;
  spaceId: string;
  reservedDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
  reservedBy: string;
}): Promise<SpaceReservation> {
  const { data, error } = await db()
    .from("space_reservations")
    .insert({
      campaign_id: input.campaignId,
      space_id: input.spaceId,
      reserved_date: input.reservedDate,
      start_time: input.startTime ?? null,
      end_time: input.endTime ?? null,
      notes: input.notes ?? null,
      reserved_by: input.reservedBy,
    })
    .select(`
      *,
      space:studio_spaces(id, name, type, sort_order),
      campaign:campaigns(id, wf_number, name),
      reserved_by_user:users!space_reservations_reserved_by_fkey(id, name)
    `)
    .single();

  if (error) throw error;
  return mapReservation(data);
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await db()
    .from("space_reservations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

function mapReservation(r: Record<string, unknown>): SpaceReservation {
  const space = r.space as Record<string, unknown> | null;
  const campaign = r.campaign as Record<string, unknown> | null;
  const byUser = r.reserved_by_user as Record<string, unknown> | null;
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    spaceId: r.space_id as string,
    reservedDate: r.reserved_date as string,
    startTime: r.start_time as string | null,
    endTime: r.end_time as string | null,
    notes: r.notes as string | null,
    reservedBy: r.reserved_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    space: space
      ? { id: space.id as string, name: space.name as string, type: space.type as StudioSpace["type"], capacity: null, notes: null, sortOrder: space.sort_order as number }
      : undefined,
    campaign: campaign
      ? { id: campaign.id as string, wfNumber: campaign.wf_number as string, name: campaign.name as string }
      : undefined,
    reservedByUser: byUser
      ? { id: byUser.id as string, name: byUser.name as string }
      : undefined,
  };
}

// ─────────────────────────────────────────────
// Shoot Meals
// ─────────────────────────────────────────────

export async function listMeals(opts: {
  campaignId?: string;
  dateFrom?: string;
  dateTo?: string;
  location?: MealLocation;
  handlerRole?: MealHandlerRole;
}): Promise<ShootMeal[]> {
  let q = db()
    .from("shoot_meals")
    .select(`
      *,
      campaign:campaigns(id, wf_number, name),
      handler:users!shoot_meals_handler_id_fkey(id, name)
    `)
    .order("shoot_date")
    .order("meal_type");

  if (opts.campaignId)  q = q.eq("campaign_id", opts.campaignId);
  if (opts.dateFrom)    q = q.gte("shoot_date", opts.dateFrom);
  if (opts.dateTo)      q = q.lte("shoot_date", opts.dateTo);
  if (opts.location)    q = q.eq("location", opts.location);
  if (opts.handlerRole) q = q.eq("handler_role", opts.handlerRole);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapMeal);
}

export async function createMeal(input: {
  campaignId: string;
  shootDate: string;
  mealType: MealType;
  location: MealLocation;
  handlerRole: MealHandlerRole;
  handlerId?: string | null;
  headcount?: number | null;
  dietaryNotes?: string | null;
  preferences?: string | null;
  vendor?: string | null;
  deliveryTime?: string | null;
  notes?: string | null;
  createdBy: string;
}): Promise<ShootMeal> {
  const { data, error } = await db()
    .from("shoot_meals")
    .insert({
      campaign_id: input.campaignId,
      shoot_date: input.shootDate,
      meal_type: input.mealType,
      location: input.location,
      handler_role: input.handlerRole,
      handler_id: input.handlerId ?? null,
      headcount: input.headcount ?? null,
      dietary_notes: input.dietaryNotes ?? null,
      preferences: input.preferences ?? null,
      vendor: input.vendor ?? null,
      delivery_time: input.deliveryTime ?? null,
      notes: input.notes ?? null,
      created_by: input.createdBy,
    })
    .select(`
      *,
      campaign:campaigns(id, wf_number, name),
      handler:users!shoot_meals_handler_id_fkey(id, name)
    `)
    .single();

  if (error) throw error;
  return mapMeal(data);
}

export async function updateMeal(
  id: string,
  patch: Partial<{
    headcount: number | null;
    dietaryNotes: string | null;
    preferences: string | null;
    vendor: string | null;
    deliveryTime: string | null;
    notes: string | null;
    status: MealStatus;
    handlerId: string | null;
  }>
): Promise<ShootMeal> {
  const updates: Record<string, unknown> = {};
  if ("headcount"    in patch) updates.headcount     = patch.headcount;
  if ("dietaryNotes" in patch) updates.dietary_notes = patch.dietaryNotes;
  if ("preferences"  in patch) updates.preferences   = patch.preferences;
  if ("vendor"       in patch) updates.vendor        = patch.vendor;
  if ("deliveryTime" in patch) updates.delivery_time = patch.deliveryTime;
  if ("notes"        in patch) updates.notes         = patch.notes;
  if ("status"       in patch) updates.status        = patch.status;
  if ("handlerId"    in patch) updates.handler_id    = patch.handlerId;

  const { data, error } = await db()
    .from("shoot_meals")
    .update(updates)
    .eq("id", id)
    .select(`
      *,
      campaign:campaigns(id, wf_number, name),
      handler:users!shoot_meals_handler_id_fkey(id, name)
    `)
    .single();

  if (error) throw error;
  return mapMeal(data);
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await db().from("shoot_meals").delete().eq("id", id);
  if (error) throw error;
}

// ─────────────────────────────────────────────
// Auto Food Plan — creates a crafty entry when
// a Greenroom space is reserved, pre-filled
// with crew headcount and dietary/preference data
// ─────────────────────────────────────────────

interface CrewProfile {
  name: string;
  dietaryRestrictions: string;
  allergies: string;
  favoriteDrinks: string;
  favoriteSnacks: string;
  energyBoost: string;
  favoritePublixProduct: string;
}

function tallyPreferences(items: string[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => count > 1 ? `${name} (${count})` : name)
    .join(", ");
}

function buildDietaryNotes(crew: CrewProfile[]): string {
  const parts: string[] = [];

  // Aggregate restrictions
  const restrictionMap = new Map<string, string[]>();
  for (const c of crew) {
    if (c.dietaryRestrictions) {
      const key = c.dietaryRestrictions.trim();
      if (!restrictionMap.has(key)) restrictionMap.set(key, []);
      restrictionMap.get(key)!.push(c.name.split(" ")[0]);
    }
  }
  if (restrictionMap.size > 0) {
    const items = [...restrictionMap.entries()]
      .map(([restriction, names]) => `${restriction} (${names.join(", ")})`)
      .join("; ");
    parts.push(`Restrictions: ${items}`);
  }

  // Aggregate allergies
  const allergyMap = new Map<string, string[]>();
  for (const c of crew) {
    if (c.allergies) {
      const key = c.allergies.trim();
      if (!allergyMap.has(key)) allergyMap.set(key, []);
      allergyMap.get(key)!.push(c.name.split(" ")[0]);
    }
  }
  if (allergyMap.size > 0) {
    const items = [...allergyMap.entries()]
      .map(([allergy, names]) => `${allergy} (${names.join(", ")})`)
      .join("; ");
    parts.push(`Allergies: ${items}`);
  }

  return parts.join("\n");
}

function buildPreferences(crew: CrewProfile[]): string {
  const parts: string[] = [];

  const drinks = crew.map((c) => c.favoriteDrinks).filter(Boolean);
  if (drinks.length) parts.push(`Drinks: ${tallyPreferences(drinks)}`);

  const snacks = crew.map((c) => c.favoriteSnacks).filter(Boolean);
  if (snacks.length) parts.push(`Snacks: ${tallyPreferences(snacks)}`);

  const energy = crew.map((c) => c.energyBoost).filter(Boolean);
  if (energy.length) parts.push(`Energy: ${tallyPreferences(energy)}`);

  const publix = crew.map((c) => c.favoritePublixProduct).filter(Boolean);
  if (publix.length) parts.push(`Publix Faves: ${tallyPreferences(publix)}`);

  return parts.join("\n");
}

export async function autoCreateFoodPlan(
  campaignId: string,
  shootDate: string,
  createdBy: string
): Promise<ShootMeal | null> {
  const client = db();

  // 1. Check if a crafty entry already exists for this campaign + date
  const { data: existing } = await client
    .from("shoot_meals")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("shoot_date", shootDate)
    .eq("meal_type", "crafty")
    .limit(1);

  if (existing && existing.length > 0) return null; // Already planned

  // 2. Get shoots for this campaign
  const { data: shoots } = await client
    .from("shoots")
    .select("id, crew_varies_by_day")
    .eq("campaign_id", campaignId);

  if (!shoots || shoots.length === 0) return null;

  const shootIds = shoots.map((s) => s.id);

  // 3. Get shoot dates matching this date (to handle crew_varies_by_day)
  const { data: shootDates } = await client
    .from("shoot_dates")
    .select("id, shoot_id")
    .in("shoot_id", shootIds)
    .eq("shoot_date", shootDate);

  const shootDateIds = (shootDates ?? []).map((sd) => sd.id);

  // 4. Get crew with user profiles
  const { data: crewRows } = await client
    .from("shoot_crew")
    .select("*, users(id, name, dietary_restrictions, allergies, favorite_drinks, favorite_snacks, energy_boost, favorite_publix_product)")
    .in("shoot_id", shootIds);

  if (!crewRows || crewRows.length === 0) return null;

  // 5. Filter crew if varies by day — only include crew for this specific date
  const crewVariesByDay = shoots.some((s) => s.crew_varies_by_day);
  let filteredCrew = crewRows;
  if (crewVariesByDay && shootDateIds.length > 0) {
    filteredCrew = crewRows.filter(
      (c) => !c.shoot_date_id || shootDateIds.includes(c.shoot_date_id)
    );
  }

  // 6. Deduplicate by user_id (same person on multiple shoots)
  const uniqueUsers = new Map<string, CrewProfile>();
  for (const c of filteredCrew) {
    const user = c.users as Record<string, unknown> | null;
    if (!user) continue;
    const uid = user.id as string;
    if (uniqueUsers.has(uid)) continue;
    uniqueUsers.set(uid, {
      name: (user.name as string) || "",
      dietaryRestrictions: (user.dietary_restrictions as string) || "",
      allergies: (user.allergies as string) || "",
      favoriteDrinks: (user.favorite_drinks as string) || "",
      favoriteSnacks: (user.favorite_snacks as string) || "",
      energyBoost: (user.energy_boost as string) || "",
      favoritePublixProduct: (user.favorite_publix_product as string) || "",
    });
  }

  const crewProfiles = [...uniqueUsers.values()];
  if (crewProfiles.length === 0) return null;

  // 7. Build aggregated notes
  const dietaryNotes = buildDietaryNotes(crewProfiles);
  const preferences = buildPreferences(crewProfiles);

  // 8. Create the crafty entry
  return createMeal({
    campaignId,
    shootDate,
    mealType: "crafty",
    location: "greenroom",
    handlerRole: "studio",
    headcount: crewProfiles.length,
    dietaryNotes: dietaryNotes || null,
    preferences: preferences || null,
    notes: `Auto-generated from ${crewProfiles.length} crew members`,
    createdBy,
  });
}

function mapMeal(r: Record<string, unknown>): ShootMeal {
  const campaign = r.campaign as Record<string, unknown> | null;
  const handler = r.handler as Record<string, unknown> | null;
  return {
    id: r.id as string,
    campaignId: r.campaign_id as string,
    shootDate: r.shoot_date as string,
    mealType: r.meal_type as MealType,
    location: r.location as MealLocation,
    handlerRole: r.handler_role as MealHandlerRole,
    handlerId: r.handler_id as string | null,
    headcount: r.headcount as number | null,
    dietaryNotes: r.dietary_notes as string | null,
    preferences: r.preferences as string | null,
    vendor: r.vendor as string | null,
    deliveryTime: r.delivery_time as string | null,
    notes: r.notes as string | null,
    status: r.status as MealStatus,
    createdBy: r.created_by as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    campaign: campaign
      ? { id: campaign.id as string, wfNumber: campaign.wf_number as string, name: campaign.name as string }
      : undefined,
    handler: handler
      ? { id: handler.id as string, name: handler.name as string }
      : undefined,
  };
}
