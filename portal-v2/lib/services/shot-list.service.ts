import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ShotListSetup,
  ShotListShot,
  ShotDeliverableLink,
  ShotProductLink,
  ShotStatus,
} from "@/types/domain";
import type {
  CreateSetupInput,
  UpdateSetupInput,
  CreateShotInput,
  UpdateShotInput,
} from "@/lib/validation/shot-list.schema";

// --- Mapping helpers ---

function toSetup(row: Record<string, unknown>, shots: ShotListShot[] = []): ShotListSetup {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    description: row.description as string,
    location: (row.location as string) || "",
    mediaType: (row.media_type as string) || "",
    sortOrder: Number(row.sort_order) || 0,
    shots,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toShot(
  row: Record<string, unknown>,
  links: ShotDeliverableLink[] = [],
  productLinks: ShotProductLink[] = [],
): ShotListShot {
  return {
    id: row.id as string,
    setupId: row.setup_id as string,
    campaignId: row.campaign_id as string,
    name: (row.name as string) || "",
    description: (row.description as string) || "",
    angle: (row.angle as string) || "",
    mediaType: (row.media_type as string) || "",
    location: (row.location as string) || "",
    referenceImageUrl: (row.reference_image_url as string) || null,
    status: row.status as ShotStatus,
    completedAt: (row.completed_at as string) || null,
    completedBy: (row.completed_by as string) || null,
    notes: (row.notes as string) || "",
    talent: (row.talent as string) || "",
    props: (row.props as string) || "",
    wardrobe: (row.wardrobe as string) || "",
    surface: (row.surface as string) || "",
    lighting: (row.lighting as string) || "",
    priority: (row.priority as string) || "",
    retouchingNotes: (row.retouching_notes as string) || "",
    sortOrder: Number(row.sort_order) || 0,
    deliverableLinks: links,
    productLinks,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toLink(row: Record<string, unknown>): ShotDeliverableLink {
  return {
    id: row.id as string,
    shotId: row.shot_id as string,
    deliverableId: row.deliverable_id as string,
  };
}

function toProductLink(row: Record<string, unknown>): ShotProductLink {
  return {
    id: row.id as string,
    shotId: row.shot_id as string,
    campaignProductId: row.campaign_product_id as string,
    notes: (row.notes as string) || "",
    quantity: (row.quantity as string) || "",
  };
}

// --- Setups ---

export async function listSetups(campaignId: string): Promise<ShotListSetup[]> {
  const db = createAdminClient();

  const { data: setups, error: setupErr } = await db
    .from("shot_list_setups")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });

  if (setupErr) throw setupErr;
  if (!setups?.length) return [];

  // Fetch all shots for this campaign
  const { data: shots, error: shotErr } = await db
    .from("shot_list_shots")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });

  if (shotErr) throw shotErr;

  // Fetch all deliverable links for shots in this campaign
  const shotIds = (shots || []).map((s) => s.id);
  let links: Record<string, unknown>[] = [];
  let prodLinks: Record<string, unknown>[] = [];
  if (shotIds.length > 0) {
    const [linkRes, prodRes] = await Promise.all([
      db.from("shot_deliverable_links").select("*").in("shot_id", shotIds),
      db.from("shot_product_links").select("*").in("shot_id", shotIds),
    ]);
    links = (linkRes.data || []) as Record<string, unknown>[];
    prodLinks = (prodRes.data || []) as Record<string, unknown>[];
  }

  // Group links by shot
  const linksByShot = new Map<string, ShotDeliverableLink[]>();
  for (const l of links) {
    const shotId = l.shot_id as string;
    if (!linksByShot.has(shotId)) linksByShot.set(shotId, []);
    linksByShot.get(shotId)!.push(toLink(l));
  }

  // Group product links by shot
  const prodLinksByShot = new Map<string, ShotProductLink[]>();
  for (const l of prodLinks) {
    const shotId = l.shot_id as string;
    if (!prodLinksByShot.has(shotId)) prodLinksByShot.set(shotId, []);
    prodLinksByShot.get(shotId)!.push(toProductLink(l));
  }

  // Group shots by setup
  const shotsBySetup = new Map<string, ShotListShot[]>();
  for (const s of shots || []) {
    const setupId = s.setup_id as string;
    if (!shotsBySetup.has(setupId)) shotsBySetup.set(setupId, []);
    shotsBySetup.get(setupId)!.push(
      toShot(
        s as Record<string, unknown>,
        linksByShot.get(s.id) || [],
        prodLinksByShot.get(s.id) || [],
      )
    );
  }

  return setups.map((s) =>
    toSetup(s as Record<string, unknown>, shotsBySetup.get(s.id) || [])
  );
}

export async function createSetup(input: CreateSetupInput): Promise<ShotListSetup> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_list_setups")
    .insert({
      campaign_id: input.campaignId,
      name: input.name,
      description: input.description,
      location: input.location,
      media_type: input.mediaType,
      sort_order: input.sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return toSetup(data as Record<string, unknown>, []);
}

export async function updateSetup(id: string, input: UpdateSetupInput): Promise<ShotListSetup> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.location !== undefined) update.location = input.location;
  if (input.mediaType !== undefined) update.media_type = input.mediaType;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;

  const { data, error } = await db
    .from("shot_list_setups")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toSetup(data as Record<string, unknown>);
}

export async function deleteSetup(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shot_list_setups").delete().eq("id", id);
  if (error) throw error;
}

// --- Shots ---

export async function createShot(input: CreateShotInput): Promise<ShotListShot> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_list_shots")
    .insert({
      setup_id: input.setupId,
      campaign_id: input.campaignId,
      name: input.name || "",
      description: input.description || "",
      angle: input.angle || "",
      notes: input.notes,
      sort_order: input.sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return toShot(data as Record<string, unknown>, [], []);
}

export async function updateShot(
  id: string,
  input: UpdateShotInput,
  userId?: string
): Promise<ShotListShot> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.angle !== undefined) update.angle = input.angle;
  if (input.mediaType !== undefined) update.media_type = input.mediaType;
  if (input.location !== undefined) update.location = input.location;
  if (input.referenceImageUrl !== undefined) update.reference_image_url = input.referenceImageUrl;
  if (input.notes !== undefined) update.notes = input.notes;
  if (input.talent !== undefined) update.talent = input.talent;
  if (input.props !== undefined) update.props = input.props;
  if (input.wardrobe !== undefined) update.wardrobe = input.wardrobe;
  if (input.surface !== undefined) update.surface = input.surface;
  if (input.lighting !== undefined) update.lighting = input.lighting;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.retouchingNotes !== undefined) update.retouching_notes = input.retouchingNotes;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.status !== undefined) {
    update.status = input.status;
    if (input.status === "Complete") {
      update.completed_at = new Date().toISOString();
      if (userId) update.completed_by = userId;
    } else {
      update.completed_at = null;
      update.completed_by = null;
    }
  }

  const { data, error } = await db
    .from("shot_list_shots")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toShot(data as Record<string, unknown>);
}

export async function deleteShot(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shot_list_shots").delete().eq("id", id);
  if (error) throw error;
}

// --- Deliverable Links ---

export async function linkDeliverable(
  shotId: string,
  deliverableId: string
): Promise<ShotDeliverableLink> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_deliverable_links")
    .insert({ shot_id: shotId, deliverable_id: deliverableId })
    .select()
    .single();

  if (error) throw error;
  return toLink(data as Record<string, unknown>);
}

export async function unlinkDeliverable(shotId: string, deliverableId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("shot_deliverable_links")
    .delete()
    .eq("shot_id", shotId)
    .eq("deliverable_id", deliverableId);
  if (error) throw error;
}

// --- Product Links ---

export async function linkProduct(
  shotId: string,
  campaignProductId: string,
  notes: string = "",
  quantity: string = "",
): Promise<ShotProductLink> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_product_links")
    .insert({
      shot_id: shotId,
      campaign_product_id: campaignProductId,
      notes,
      quantity,
    })
    .select()
    .single();

  if (error) throw error;
  return toProductLink(data as Record<string, unknown>);
}

export async function unlinkProduct(shotId: string, campaignProductId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("shot_product_links")
    .delete()
    .eq("shot_id", shotId)
    .eq("campaign_product_id", campaignProductId);
  if (error) throw error;
}
