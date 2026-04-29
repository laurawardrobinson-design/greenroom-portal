import { createAdminClient } from "@/lib/supabase/admin";
import { mirrorProductImage, shouldMirror } from "@/lib/products/mirror-image";
import type {
  Product,
  ProductDepartment,
  ProductLifecyclePhase,
  CampaignProduct,
  CampaignProductRole,
  CampaignGearLink,
  GearItem,
} from "@/types/domain";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validation/products.schema";

async function resolveImageForSave(
  imageUrl: string | null | undefined,
  pathKey: string
): Promise<{ image_url: string | null; source_image_url: string | null } | null> {
  if (imageUrl === undefined) return null;
  if (!imageUrl) return { image_url: null, source_image_url: null };
  if (!shouldMirror(imageUrl)) return { image_url: imageUrl, source_image_url: null };
  try {
    const m = await mirrorProductImage(imageUrl, pathKey);
    return { image_url: m.imageUrl, source_image_url: m.sourceImageUrl };
  } catch {
    // Mirror failed (timeout, 404, etc.) — fall back to the external URL
    // rather than blocking the save. source_image_url retains the original
    // so a later backfill can retry.
    return { image_url: imageUrl, source_image_url: imageUrl };
  }
}

// --- Mapping helpers ---

function toProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    name: row.name as string,
    department: row.department as ProductDepartment,
    itemCode: (row.item_code as string) || null,
    description: row.description as string,
    shootingNotes: row.shooting_notes as string,
    restrictions: row.restrictions as string,
    pcomLink: (row.pcom_link as string) || null,
    pcomLinkBrokenAt: (row.pcom_link_broken_at as string) || null,
    rpGuideUrl: (row.rp_guide_url as string) || null,
    imageUrl: (row.image_url as string) || null,
    lifecyclePhase:
      ((row.lifecycle_phase as ProductLifecyclePhase) ?? "live") as ProductLifecyclePhase,
    createdBy: (row.created_by as string) || null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toCampaignProduct(row: Record<string, unknown>): CampaignProduct {
  const productData = row.products || row.product;
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    productId: row.product_id as string,
    notes: row.notes as string,
    sortOrder: Number(row.sort_order) || 0,
    role: (row.role as CampaignProductRole) || null,
    product: productData ? toProduct(productData as Record<string, unknown>) : undefined,
  };
}

function toCampaignGear(row: Record<string, unknown>): CampaignGearLink {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    gearItemId: row.gear_item_id as string,
    notes: row.notes as string,
    gearItem: row.gear_items
      ? toGearItem(row.gear_items as Record<string, unknown>)
      : undefined,
  };
}

function toGearItem(row: Record<string, unknown>): GearItem {
  return {
    id: row.id as string,
    name: row.name as string,
    section: ((row.section as string) || "Gear") as GearItem["section"],
    category: row.category as GearItem["category"],
    brand: (row.brand as string) || "",
    model: (row.model as string) || "",
    serialNumber: (row.serial_number as string) || "",
    qrCode: (row.qr_code as string) || "",
    rfidTag: (row.rfid_tag as string) || null,
    status: row.status as GearItem["status"],
    condition: row.condition as GearItem["condition"],
    purchaseDate: (row.purchase_date as string) || null,
    purchasePrice: Number(row.purchase_price) || 0,
    warrantyExpiry: (row.warranty_expiry as string) || null,
    imageUrl: (row.image_url as string) || "",
    notes: (row.notes as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// --- Product Directory CRUD ---

export async function listProducts(filters?: {
  department?: ProductDepartment;
  search?: string;
  lifecyclePhase?: ProductLifecyclePhase;
}): Promise<Product[]> {
  const db = createAdminClient();
  let query = db.from("products").select("*").order("name", { ascending: true });

  if (filters?.department) {
    query = query.eq("department", filters.department);
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,item_code.ilike.%${filters.search}%`
    );
  }
  if (filters?.lifecyclePhase) {
    query = query.eq("lifecycle_phase", filters.lifecyclePhase);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => toProduct(r as Record<string, unknown>));
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("products").select("*").eq("id", id).single();
  if (error) return null;
  return toProduct(data as Record<string, unknown>);
}

export async function createProduct(input: CreateProductInput, userId: string): Promise<Product> {
  const db = createAdminClient();
  const pathKey = input.itemCode || input.name;
  const resolved = await resolveImageForSave(input.imageUrl, pathKey);
  const { data, error } = await db
    .from("products")
    .insert({
      name: input.name,
      department: input.department,
      item_code: input.itemCode,
      description: input.description,
      shooting_notes: input.shootingNotes,
      restrictions: input.restrictions,
      pcom_link: input.pcomLink,
      rp_guide_url: input.rpGuideUrl,
      image_url: resolved ? resolved.image_url : input.imageUrl,
      source_image_url: resolved?.source_image_url ?? null,
      lifecycle_phase: input.lifecyclePhase ?? "live",
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return toProduct(data as Record<string, unknown>);
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<Product> {
  const db = createAdminClient();
  const update: Record<string, unknown> = {};
  if (input.name !== undefined) update.name = input.name;
  if (input.department !== undefined) update.department = input.department;
  if (input.itemCode !== undefined) update.item_code = input.itemCode;
  if (input.description !== undefined) update.description = input.description;
  if (input.shootingNotes !== undefined) update.shooting_notes = input.shootingNotes;
  if (input.restrictions !== undefined) update.restrictions = input.restrictions;
  if (input.pcomLink !== undefined) {
    update.pcom_link = input.pcomLink;
    update.pcom_link_broken_at = null;
  }
  if (input.rpGuideUrl !== undefined) update.rp_guide_url = input.rpGuideUrl;
  if (input.imageUrl !== undefined) {
    const existing = await db
      .from("products")
      .select("name, item_code")
      .eq("id", id)
      .single();
    const pathKey =
      input.itemCode ||
      (existing.data?.item_code as string | null) ||
      input.name ||
      (existing.data?.name as string | null) ||
      id;
    const resolved = await resolveImageForSave(input.imageUrl, pathKey);
    if (resolved) {
      update.image_url = resolved.image_url;
      update.source_image_url = resolved.source_image_url;
    } else {
      update.image_url = input.imageUrl;
    }
  }
  if (input.lifecyclePhase !== undefined) update.lifecycle_phase = input.lifecyclePhase;

  const { data, error } = await db
    .from("products")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return toProduct(data as Record<string, unknown>);
}

export async function deleteProduct(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) throw error;
}

export async function markPcomLinkBroken(id: string): Promise<Product> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("products")
    .update({ pcom_link_broken_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toProduct(data as Record<string, unknown>);
}

// --- Campaign Products (link products to campaigns) ---

export async function listCampaignProducts(campaignId: string): Promise<CampaignProduct[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .select("*, products(*)")
    .eq("campaign_id", campaignId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data || []).map((r) => toCampaignProduct(r as Record<string, unknown>));
}

export async function linkProductToCampaign(
  campaignId: string,
  productId: string,
  notes = "",
  sortOrder = 0
): Promise<CampaignProduct> {
  const db = createAdminClient();

  // Return existing link if already linked
  const { data: existing } = await db
    .from("campaign_products")
    .select("*, products(*)")
    .eq("campaign_id", campaignId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) return toCampaignProduct(existing as Record<string, unknown>);

  const { data, error } = await db
    .from("campaign_products")
    .insert({ campaign_id: campaignId, product_id: productId, notes, sort_order: sortOrder })
    .select("*, products(*)")
    .single();

  if (error) throw error;
  return toCampaignProduct(data as Record<string, unknown>);
}

export async function setCampaignProductRole(
  id: string,
  role: CampaignProductRole | null
): Promise<CampaignProduct> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .update({ role })
    .eq("id", id)
    .select("*, products(*)")
    .single();
  if (error) throw error;
  return toCampaignProduct(data as Record<string, unknown>);
}

export async function unlinkProductFromCampaign(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("campaign_products").delete().eq("id", id);
  if (error) throw error;
}

// --- Campaign Product History (which campaigns used a product) ---

export async function getProductCampaignHistory(
  productId: string
): Promise<{ campaignId: string; campaignName: string; wfNumber: string; role: "hero" | "secondary" | null }[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .select("campaign_id, role, campaigns(name, wf_number)")
    .eq("product_id", productId);

  if (error) throw error;
  return (data || []).map((r) => {
    const campaign = (r as Record<string, unknown>).campaigns as Record<string, unknown>;
    const role = (r as Record<string, unknown>).role as string | null;
    return {
      campaignId: r.campaign_id,
      campaignName: (campaign?.name as string) || "",
      wfNumber: (campaign?.wf_number as string) || "",
      role: role === "hero" || role === "secondary" ? role : null,
    };
  });
}

export async function getProductShootSchedule(productId: string): Promise<{
  upcoming: { campaignId: string; campaignName: string; wfNumber: string; role: "hero" | "secondary" | null; date: string; shootName: string }[];
  planning: { campaignId: string; campaignName: string; wfNumber: string; role: "hero" | "secondary" | null }[];
}> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .select("campaign_id, role, campaigns(id, name, wf_number, shoots(name, shoot_dates(shoot_date)))")
    .eq("product_id", productId);
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming: Awaited<ReturnType<typeof getProductShootSchedule>>["upcoming"] = [];
  const planning: Awaited<ReturnType<typeof getProductShootSchedule>>["planning"] = [];

  for (const r of data || []) {
    const campaign = (r as Record<string, unknown>).campaigns as Record<string, unknown> | null;
    if (!campaign) continue;
    const roleRaw = (r as Record<string, unknown>).role as string | null;
    const role = roleRaw === "hero" || roleRaw === "secondary" ? roleRaw : null;
    const base: Awaited<ReturnType<typeof getProductShootSchedule>>["planning"][number] = {
      campaignId: r.campaign_id as string,
      campaignName: (campaign.name as string) || "",
      wfNumber: (campaign.wf_number as string) || "",
      role,
    };
    const shoots = (campaign.shoots as Array<Record<string, unknown>>) || [];
    const futureDates: { date: string; shootName: string }[] = [];
    for (const s of shoots) {
      const dates = (s.shoot_dates as Array<{ shoot_date: string }>) || [];
      for (const d of dates) {
        if (d.shoot_date >= today) futureDates.push({ date: d.shoot_date, shootName: (s.name as string) || "" });
      }
    }
    if (futureDates.length > 0) {
      for (const fd of futureDates) upcoming.push({ ...base, date: fd.date, shootName: fd.shootName });
    } else {
      planning.push(base);
    }
  }

  upcoming.sort((a, b) => a.date.localeCompare(b.date));
  return { upcoming, planning };
}

// --- Cross-product review (every product's future intended use) ---

export type ProductReviewRow = {
  // campaign_products link id — primary key for approve / unapprove actions.
  campaignProductId: string;
  product: {
    id: string;
    name: string;
    itemCode: string | null;
    imageUrl: string | null;
    department: ProductDepartment;
  };
  campaignId: string;
  campaignName: string;
  wfNumber: string;
  role: "hero" | "secondary" | null;
  // earliest future shoot date for this (product × campaign), or null when
  // the campaign exists but has no future shoot dates yet ("Planning").
  date: string | null;
  shootName: string | null;
  // ISO timestamp once an RBU member has approved this link as accurate.
  rbuApprovedAt: string | null;
  rbuApprovedBy: string | null;
};

// One row per (product × campaign) pair that has any future intended use.
// Mirrors the per-product Upcoming section in ProductDrawer; date logic
// matches getProductShootSchedule() — a campaign with no future shoot
// dates falls into planning (date=null), exactly like the drawer.
export async function listProductsWithUpcomingUse(opts?: {
  department?: ProductDepartment;
}): Promise<ProductReviewRow[]> {
  const db = createAdminClient();
  let query = db
    .from("products")
    .select(
      "id, name, item_code, image_url, department, campaign_products(id, campaign_id, role, rbu_approved_at, rbu_approved_by, campaigns(id, name, wf_number, shoots(name, shoot_dates(shoot_date))))"
    );
  if (opts?.department) query = query.eq("department", opts.department);
  const { data, error } = await query;
  if (error) throw error;

  const today = new Date().toISOString().slice(0, 10);
  const rows: ProductReviewRow[] = [];

  for (const productRow of data || []) {
    const p = productRow as Record<string, unknown>;
    const product = {
      id: p.id as string,
      name: p.name as string,
      itemCode: (p.item_code as string) || null,
      imageUrl: (p.image_url as string) || null,
      department: p.department as ProductDepartment,
    };
    const links = (p.campaign_products as Array<Record<string, unknown>>) || [];

    // Per campaign: find the earliest future shoot date. If none exist, treat
    // as planning (mirrors getProductShootSchedule). Skip campaigns with only
    // past dates so closed campaigns don't pollute the review list.
    for (const link of links) {
      const campaign = link.campaigns as Record<string, unknown> | null;
      if (!campaign) continue;
      const roleRaw = link.role as string | null;
      const role: "hero" | "secondary" | null =
        roleRaw === "hero" || roleRaw === "secondary" ? roleRaw : null;
      const shoots = (campaign.shoots as Array<Record<string, unknown>>) || [];
      let earliest: { date: string; shootName: string } | null = null;
      let hasAnyDate = false;
      for (const s of shoots) {
        const dates = (s.shoot_dates as Array<{ shoot_date: string }>) || [];
        for (const d of dates) {
          hasAnyDate = true;
          if (d.shoot_date >= today) {
            if (!earliest || d.shoot_date < earliest.date) {
              earliest = { date: d.shoot_date, shootName: (s.name as string) || "" };
            }
          }
        }
      }
      const base = {
        campaignProductId: link.id as string,
        product,
        campaignId: link.campaign_id as string,
        campaignName: (campaign.name as string) || "",
        wfNumber: (campaign.wf_number as string) || "",
        role,
        rbuApprovedAt: (link.rbu_approved_at as string) || null,
        rbuApprovedBy: (link.rbu_approved_by as string) || null,
      };
      if (earliest) {
        rows.push({ ...base, date: earliest.date, shootName: earliest.shootName });
      } else if (!hasAnyDate) {
        rows.push({ ...base, date: null, shootName: null });
      }
    }
  }

  rows.sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return a.product.name.localeCompare(b.product.name);
  });

  return rows;
}

// --- Most recent RBU approval across any campaign for a product ---

export async function getProductLastApproval(
  productId: string
): Promise<{ at: string; by: string | null; campaignId: string; campaignName: string; wfNumber: string } | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .select("rbu_approved_at, rbu_approved_by, campaign_id, campaigns(name, wf_number)")
    .eq("product_id", productId)
    .not("rbu_approved_at", "is", null)
    .order("rbu_approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const userId = (data.rbu_approved_by as string | null) || null;
  let by: string | null = null;
  if (userId) {
    const { data: user } = await db.from("users").select("name").eq("id", userId).maybeSingle();
    by = (user?.name as string | undefined) || null;
  }
  const campaign =
    (data.campaigns as unknown as Record<string, unknown> | null) || null;
  return {
    at: data.rbu_approved_at as string,
    by,
    campaignId: data.campaign_id as string,
    campaignName: (campaign?.name as string) || "",
    wfNumber: (campaign?.wf_number as string) || "",
  };
}

// --- RBU accuracy approval on campaign_products ---

export async function setCampaignProductRbuApproval(
  id: string,
  approved: boolean,
  userId: string | null
): Promise<void> {
  const db = createAdminClient();
  const update = approved
    ? { rbu_approved_at: new Date().toISOString(), rbu_approved_by: userId }
    : { rbu_approved_at: null, rbu_approved_by: null };
  const { error } = await db.from("campaign_products").update(update).eq("id", id);
  if (error) throw error;
}

// --- Campaign Gear (link gear items to campaigns) ---

export async function listCampaignGear(campaignId: string): Promise<CampaignGearLink[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_gear")
    .select("*, gear_items(*)")
    .eq("campaign_id", campaignId);

  if (error) throw error;
  return (data || []).map((r) => toCampaignGear(r as Record<string, unknown>));
}

export async function linkGearToCampaign(
  campaignId: string,
  gearItemId: string,
  notes = ""
): Promise<CampaignGearLink> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_gear")
    .insert({ campaign_id: campaignId, gear_item_id: gearItemId, notes })
    .select("*, gear_items(*)")
    .single();

  if (error) throw error;
  return toCampaignGear(data as Record<string, unknown>);
}

export async function unlinkGearFromCampaign(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("campaign_gear").delete().eq("id", id);
  if (error) throw error;
}
