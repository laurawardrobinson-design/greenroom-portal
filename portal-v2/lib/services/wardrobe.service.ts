import { createAdminClient } from "@/lib/supabase/admin";
import type { WardrobeItem, WardrobeCategory } from "@/types/domain";
import type { CreateWardrobeInput, UpdateWardrobeInput } from "@/lib/validation/wardrobe.schema";

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
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listWardrobeItems(filters?: {
  category?: WardrobeCategory;
  search?: string;
}): Promise<WardrobeItem[]> {
  const db = createAdminClient();
  let query = db.from("wardrobe_items").select("*").order("name", { ascending: true });

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

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
