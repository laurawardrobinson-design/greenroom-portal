import { createAdminClient } from "@/lib/supabase/admin";
import type { ShootCrew, AppUser } from "@/types/domain";

function toUser(row: Record<string, unknown>): AppUser {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    role: row.role as AppUser["role"],
    active: row.active as boolean,
    avatarUrl: (row.avatar_url as string) || "",
    phone: (row.phone as string) || "",
    title: (row.title as string) || "",
    vendorId: (row.vendor_id as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listShootCrew(
  shootId: string
): Promise<ShootCrew[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shoot_crew")
    .select("*, users(*)")
    .eq("shoot_id", shootId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    shootId: row.shoot_id,
    userId: row.user_id,
    shootDateId: row.shoot_date_id || null,
    roleOnShoot: row.role_on_shoot,
    notes: row.notes || "",
    user: row.users ? toUser(row.users) : undefined,
  }));
}

export async function addShootCrewMember(input: {
  shootId: string;
  userId: string;
  roleOnShoot: string;
  notes?: string;
  shootDateId?: string | null;
}): Promise<ShootCrew> {
  const db = createAdminClient();
  const insertData: Record<string, unknown> = {
    shoot_id: input.shootId,
    user_id: input.userId,
    role_on_shoot: input.roleOnShoot,
    notes: input.notes || "",
  };
  if (input.shootDateId) insertData.shoot_date_id = input.shootDateId;

  const { data, error } = await db
    .from("shoot_crew")
    .insert(insertData)
    .select("*, users(*)")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("This person is already on the crew for this shoot");
    }
    throw error;
  }

  return {
    id: data.id,
    shootId: data.shoot_id,
    userId: data.user_id,
    shootDateId: data.shoot_date_id || null,
    roleOnShoot: data.role_on_shoot,
    notes: data.notes || "",
    user: data.users ? toUser(data.users) : undefined,
  };
}

export async function removeShootCrewMember(crewId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shoot_crew").delete().eq("id", crewId);
  if (error) throw error;
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  title?: string;
  role?: string;
}): Promise<AppUser> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("users")
    .insert({
      id: crypto.randomUUID(),
      name: input.name,
      email: input.email,
      phone: input.phone || "",
      title: input.title || "",
      role: input.role || "Studio",
      active: true,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A user with this email already exists");
    throw error;
  }
  return toUser(data);
}

export async function updateUser(
  id: string,
  updates: { role?: string; active?: boolean }
): Promise<AppUser> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.active !== undefined) updateData.active = updates.active;

  const { data, error } = await db
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return toUser(data);
}

export async function listUsers(filters?: {
  roles?: string[];
  active?: boolean;
}): Promise<AppUser[]> {
  const db = createAdminClient();
  let query = db.from("users").select("*").order("name");

  if (filters?.active !== undefined) query = query.eq("active", filters.active);
  if (filters?.roles?.length) query = query.in("role", filters.roles);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toUser);
}
