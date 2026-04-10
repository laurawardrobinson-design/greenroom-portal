import { createAdminClient } from "@/lib/supabase/admin";
import type { JobClass, JobClassItem, JobClassNote, WardrobeItem, WardrobeCategory, WardrobeCondition } from "@/types/domain";

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

function toJobClassItem(row: Record<string, unknown>): JobClassItem {
  const itemData = row.wardrobe_items as Record<string, unknown> | null;
  return {
    id: row.id as string,
    jobClassId: row.job_class_id as string,
    wardrobeItemId: row.wardrobe_item_id as string,
    notes: (row.notes as string) || "",
    sortOrder: Number(row.sort_order) || 0,
    createdAt: row.created_at as string,
    wardrobeItem: itemData ? toWardrobeItem(itemData) : undefined,
  };
}

function toJobClass(row: Record<string, unknown>, items?: JobClassItem[]): JobClass {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) || "",
    standards: (row.standards as string) || "",
    referenceUrl: (row.reference_url as string) || null,
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    items,
  };
}

function toJobClassNote(row: Record<string, unknown>): JobClassNote {
  return {
    id: row.id as string,
    jobClassId: row.job_class_id as string,
    text: row.text as string,
    authorId: (row.author_id as string) || null,
    authorName: (row.author_name as string) || "",
    campaignId: (row.campaign_id as string) || null,
    createdAt: row.created_at as string,
  };
}

// ── Job Class CRUD ────────────────────────────────────────────────────────────

export async function listJobClasses(): Promise<JobClass[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_classes")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => toJobClass(r as Record<string, unknown>));
}

export async function getJobClass(id: string): Promise<JobClass | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("job_classes").select("*").eq("id", id).single();
  if (error) return null;

  const { data: itemRows } = await db
    .from("job_class_items")
    .select("*, wardrobe_items(*)")
    .eq("job_class_id", id)
    .order("sort_order", { ascending: true });

  const items = (itemRows || []).map((r) => toJobClassItem(r as Record<string, unknown>));
  return toJobClass(data as Record<string, unknown>, items);
}

export async function createJobClass(input: {
  name: string;
  description?: string;
  standards?: string;
  referenceUrl?: string | null;
}, userId: string): Promise<JobClass> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_classes")
    .insert({
      name: input.name,
      description: input.description ?? "",
      standards: input.standards ?? "",
      reference_url: input.referenceUrl ?? null,
      created_by: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return toJobClass(data as Record<string, unknown>, []);
}

export async function updateJobClass(id: string, input: {
  name?: string;
  description?: string;
  standards?: string;
  referenceUrl?: string | null;
}): Promise<JobClass> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.standards !== undefined) update.standards = input.standards;
  if (input.referenceUrl !== undefined) update.reference_url = input.referenceUrl;

  const { data, error } = await db
    .from("job_classes")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toJobClass(data as Record<string, unknown>);
}

export async function deleteJobClass(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("job_classes").delete().eq("id", id);
  if (error) throw error;
}

// ── Job Class Items ───────────────────────────────────────────────────────────

export async function listJobClassItems(jobClassId: string): Promise<JobClassItem[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_class_items")
    .select("*, wardrobe_items(*)")
    .eq("job_class_id", jobClassId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => toJobClassItem(r as Record<string, unknown>));
}

export async function addItemToJobClass(
  jobClassId: string,
  wardrobeItemId: string,
  notes = ""
): Promise<JobClassItem> {
  const db = createAdminClient();

  // Get next sort order
  const { count } = await db
    .from("job_class_items")
    .select("*", { count: "exact", head: true })
    .eq("job_class_id", jobClassId);

  const { data, error } = await db
    .from("job_class_items")
    .insert({
      job_class_id: jobClassId,
      wardrobe_item_id: wardrobeItemId,
      notes,
      sort_order: count ?? 0,
    })
    .select("*, wardrobe_items(*)")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Item already in this job class");
    throw error;
  }
  return toJobClassItem(data as Record<string, unknown>);
}

export async function updateJobClassItem(id: string, notes: string): Promise<JobClassItem> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_class_items")
    .update({ notes })
    .eq("id", id)
    .select("*, wardrobe_items(*)")
    .single();
  if (error) throw error;
  return toJobClassItem(data as Record<string, unknown>);
}

export async function removeItemFromJobClass(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("job_class_items").delete().eq("id", id);
  if (error) throw error;
}

// ── Job Class Notes ───────────────────────────────────────────────────────────

export async function listJobClassNotes(jobClassId: string): Promise<JobClassNote[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_class_notes")
    .select("*")
    .eq("job_class_id", jobClassId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => toJobClassNote(r as Record<string, unknown>));
}

export async function addJobClassNote(params: {
  jobClassId: string;
  text: string;
  authorId: string;
  authorName: string;
  campaignId?: string;
}): Promise<JobClassNote> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("job_class_notes")
    .insert({
      job_class_id: params.jobClassId,
      text: params.text,
      author_id: params.authorId,
      author_name: params.authorName,
      campaign_id: params.campaignId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return toJobClassNote(data as Record<string, unknown>);
}

export async function deleteJobClassNote(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("job_class_notes").delete().eq("id", id);
  if (error) throw error;
}
