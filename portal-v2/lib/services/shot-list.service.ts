import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ShotListSetup,
  ShotListShot,
  ShotDeliverableLink,
  ShotProductLink,
  ShotStatus,
  ShotVariantType,
  ShotOrientation,
  ShotRetouchLevel,
  UserCampaignPreferences,
  ShotListDensity,
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
    variantType: (row.variant_type as ShotVariantType | null) ?? null,
    orientation: (row.orientation as ShotOrientation | null) ?? null,
    retouchLevel: (row.retouch_level as ShotRetouchLevel | null) ?? null,
    heroSku: (row.hero_sku as string | null) ?? null,
    isHero: Boolean(row.is_hero),
    approvedBy: (row.approved_by as string | null) ?? null,
    approvedAt: (row.approved_at as string | null) ?? null,
    approvedSnapshot: (row.approved_snapshot as Record<string, unknown> | null) ?? null,
    approvalNotes: (row.approval_notes as string) || "",
    needsReapproval: Boolean(row.needs_reapproval),
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
  if (input.productTags !== undefined) update.product_tags = input.productTags;
  if (input.sortOrder !== undefined) update.sort_order = input.sortOrder;
  if (input.variantType !== undefined) update.variant_type = input.variantType;
  if (input.orientation !== undefined) update.orientation = input.orientation;
  if (input.retouchLevel !== undefined) update.retouch_level = input.retouchLevel;
  if (input.heroSku !== undefined) update.hero_sku = input.heroSku;
  if (input.isHero !== undefined) update.is_hero = input.isHero;
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

// --- Bulk operations (Wave 2) ---

export type BulkAction = "assignDate" | "moveToSetup" | "duplicate" | "delete";

export interface BulkActionInput {
  ids: string[];
  action: BulkAction;
  shootDateId?: string | null;
  setupId?: string;
}

export async function bulkShotAction(input: BulkActionInput): Promise<{
  affected: number;
  newIds?: string[];
}> {
  const db = createAdminClient();
  const ids = Array.from(new Set(input.ids)).filter(Boolean);
  if (ids.length === 0) return { affected: 0 };

  if (input.action === "delete") {
    const { error, count } = await db
      .from("shot_list_shots")
      .delete({ count: "exact" })
      .in("id", ids);
    if (error) throw error;
    return { affected: count ?? 0 };
  }

  if (input.action === "assignDate") {
    const { error, count } = await db
      .from("shot_list_shots")
      .update({ shoot_date_id: input.shootDateId ?? null }, { count: "exact" })
      .in("id", ids);
    if (error) throw error;
    return { affected: count ?? 0 };
  }

  if (input.action === "moveToSetup") {
    if (!input.setupId) throw new Error("setupId required for moveToSetup");
    const { error, count } = await db
      .from("shot_list_shots")
      .update({ setup_id: input.setupId }, { count: "exact" })
      .in("id", ids);
    if (error) throw error;
    return { affected: count ?? 0 };
  }

  if (input.action === "duplicate") {
    const { data: sourceRows, error: fetchErr } = await db
      .from("shot_list_shots")
      .select("*")
      .in("id", ids);
    if (fetchErr) throw fetchErr;

    const sources = (sourceRows || []) as Array<Record<string, unknown>>;
    const inserts = sources.map((row) => {
      const copy: Record<string, unknown> = { ...row };
      delete copy.id;
      delete copy.created_at;
      delete copy.updated_at;
      delete copy.approved_at;
      delete copy.approved_by;
      delete copy.approved_snapshot;
      delete copy.needs_reapproval;
      delete copy.completed_at;
      delete copy.completed_by;
      copy.status = "Pending";
      copy.is_hero = false;
      const originalName = (row.name as string) || "";
      copy.name = originalName ? `${originalName} (copy)` : "Copy";
      return copy;
    });

    if (inserts.length === 0) return { affected: 0 };

    const { data: newRows, error: insertErr } = await db
      .from("shot_list_shots")
      .insert(inserts)
      .select("id");
    if (insertErr) throw insertErr;

    const newIds = (newRows || []).map((r) => (r as { id: string }).id);
    return { affected: newIds.length, newIds };
  }

  throw new Error(`Unknown bulk action: ${input.action}`);
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

// --- Shot Talent ---

export interface ShotTalent {
  id: string;
  shotId: string;
  campaignId: string;
  talentNumber: number;
  label: string;
  ageRange: string;
  gender: string;
  ethnicity: string;
  skinTone: string;
  hair: string;
  build: string;
  wardrobeNotes: string;
  notes: string;
  createdAt: string;
}

function toTalent(row: Record<string, unknown>): ShotTalent {
  return {
    id: row.id as string,
    shotId: row.shot_id as string,
    campaignId: row.campaign_id as string,
    talentNumber: Number(row.talent_number),
    label: (row.label as string) || "",
    ageRange: (row.age_range as string) || "Open",
    gender: (row.gender as string) || "Open",
    ethnicity: (row.ethnicity as string) || "Open",
    skinTone: (row.skin_tone as string) || "Open",
    hair: (row.hair as string) || "Open",
    build: (row.build as string) || "Open",
    wardrobeNotes: (row.wardrobe_notes as string) || "",
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
  };
}

export async function listCampaignTalent(campaignId: string): Promise<ShotTalent[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_talent")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("talent_number", { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => toTalent(r as Record<string, unknown>));
}

export async function getNextTalentNumber(campaignId: string): Promise<number> {
  const db = createAdminClient();
  const { data } = await db
    .from("shot_talent")
    .select("talent_number")
    .eq("campaign_id", campaignId)
    .order("talent_number", { ascending: false })
    .limit(1);
  if (data && data.length > 0) return (data[0].talent_number as number) + 1;
  return 1;
}

export async function addTalentToShot(input: {
  shotId: string;
  campaignId: string;
  talentNumber: number;
  label?: string;
  ageRange?: string;
  gender?: string;
  ethnicity?: string;
  skinTone?: string;
  hair?: string;
  build?: string;
  wardrobeNotes?: string;
  notes?: string;
}): Promise<ShotTalent> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_talent")
    .insert({
      shot_id: input.shotId,
      campaign_id: input.campaignId,
      talent_number: input.talentNumber,
      label: input.label || "",
      age_range: input.ageRange || "Open",
      gender: input.gender || "Open",
      ethnicity: input.ethnicity || "Open",
      skin_tone: input.skinTone || "Open",
      hair: input.hair || "Open",
      build: input.build || "Open",
      wardrobe_notes: input.wardrobeNotes || "",
      notes: input.notes || "",
    })
    .select()
    .single();
  if (error) throw error;
  return toTalent(data as Record<string, unknown>);
}

export async function updateTalent(id: string, input: Partial<{
  label: string;
  ageRange: string;
  gender: string;
  ethnicity: string;
  skinTone: string;
  hair: string;
  build: string;
  wardrobeNotes: string;
  notes: string;
}>): Promise<ShotTalent> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.label !== undefined) update.label = input.label;
  if (input.ageRange !== undefined) update.age_range = input.ageRange;
  if (input.gender !== undefined) update.gender = input.gender;
  if (input.ethnicity !== undefined) update.ethnicity = input.ethnicity;
  if (input.skinTone !== undefined) update.skin_tone = input.skinTone;
  if (input.hair !== undefined) update.hair = input.hair;
  if (input.build !== undefined) update.build = input.build;
  if (input.wardrobeNotes !== undefined) update.wardrobe_notes = input.wardrobeNotes;
  if (input.notes !== undefined) update.notes = input.notes;

  const { data, error } = await db
    .from("shot_talent")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toTalent(data as Record<string, unknown>);
}

// --- Approval workflow (Wave 2) ---

/**
 * Stamp an approval on a shot: record approved_by, approved_at, and freeze a
 * jsonb snapshot of the load-bearing fields at approve-time. Clears any prior
 * needs_reapproval flag. The staleness trigger re-flags needs_reapproval if
 * any snapshotted field changes afterwards.
 */
export async function approveShot(
  shotId: string,
  approvedBy: string,
  notes?: string
): Promise<ShotListShot> {
  const db = createAdminClient();

  const { data: current, error: fetchErr } = await db
    .from("shot_list_shots")
    .select("*")
    .eq("id", shotId)
    .single();
  if (fetchErr || !current) throw new Error("Shot not found");

  const row = current as Record<string, unknown>;
  const snapshot = {
    description: row.description,
    referenceImageUrl: row.reference_image_url,
    setupId: row.setup_id,
    mediaType: row.media_type,
    priority: row.priority,
    retouchLevel: row.retouch_level,
    orientation: row.orientation,
    variantType: row.variant_type,
  };

  const update: Record<string, unknown> = {
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    approved_snapshot: snapshot,
    needs_reapproval: false,
  };
  if (notes !== undefined) update.approval_notes = notes;

  const { data: updated, error } = await db
    .from("shot_list_shots")
    .update(update)
    .eq("id", shotId)
    .select("*")
    .single();

  if (error) throw error;
  return toShot(updated as Record<string, unknown>);
}

export async function updateShotApprovalNotes(
  shotId: string,
  notes: string
): Promise<ShotListShot> {
  const db = createAdminClient();
  const { data: updated, error } = await db
    .from("shot_list_shots")
    .update({ approval_notes: notes })
    .eq("id", shotId)
    .select("*")
    .single();
  if (error) throw error;
  return toShot(updated as Record<string, unknown>);
}

export async function unapproveShot(shotId: string): Promise<ShotListShot> {
  const db = createAdminClient();
  const { data: updated, error } = await db
    .from("shot_list_shots")
    .update({
      approved_by: null,
      approved_at: null,
      approved_snapshot: null,
      approval_notes: "",
      needs_reapproval: false,
    })
    .eq("id", shotId)
    .select("*")
    .single();

  if (error) throw error;
  return toShot(updated as Record<string, unknown>);
}

export async function setShotHero(shotId: string, isHero: boolean): Promise<ShotListShot> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("shot_list_shots")
    .update({ is_hero: isHero })
    .eq("id", shotId)
    .select("*")
    .single();
  if (error) throw error;
  return toShot(data as Record<string, unknown>);
}

// --- User campaign preferences (Wave 2) ---

function toUserCampaignPrefs(row: Record<string, unknown>): UserCampaignPreferences {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    campaignId: row.campaign_id as string,
    shotListDensity: (row.shot_list_density as ShotListDensity) || "detailed",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getUserCampaignPreferences(
  userId: string,
  campaignId: string
): Promise<UserCampaignPreferences | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("user_campaign_preferences")
    .select("*")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  if (!data) return null;
  return toUserCampaignPrefs(data as Record<string, unknown>);
}

export async function upsertUserCampaignPreferences(
  userId: string,
  campaignId: string,
  prefs: Partial<Pick<UserCampaignPreferences, "shotListDensity">>
): Promise<UserCampaignPreferences> {
  const db = createAdminClient();

  const update: Record<string, unknown> = {
    user_id: userId,
    campaign_id: campaignId,
  };
  if (prefs.shotListDensity) update.shot_list_density = prefs.shotListDensity;

  const { data, error } = await db
    .from("user_campaign_preferences")
    .upsert(update, { onConflict: "user_id,campaign_id" })
    .select("*")
    .single();

  if (error) throw error;
  return toUserCampaignPrefs(data as Record<string, unknown>);
}

export async function removeTalentFromShot(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("shot_talent").delete().eq("id", id);
  if (error) throw error;
}
