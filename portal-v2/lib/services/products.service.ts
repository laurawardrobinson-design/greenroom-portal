import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Product,
  ProductDepartment,
  CampaignProduct,
  CampaignGearLink,
  GearItem,
} from "@/types/domain";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validation/products.schema";

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
    rpGuideUrl: (row.rp_guide_url as string) || null,
    imageUrl: (row.image_url as string) || null,
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
}): Promise<Product[]> {
  const db = createAdminClient();
  let query = db.from("products").select("*").order("name", { ascending: true });

  if (filters?.department) {
    query = query.eq("department", filters.department);
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
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
      image_url: input.imageUrl,
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
  if (input.pcomLink !== undefined) update.pcom_link = input.pcomLink;
  if (input.rpGuideUrl !== undefined) update.rp_guide_url = input.rpGuideUrl;
  if (input.imageUrl !== undefined) update.image_url = input.imageUrl;

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
  const { data, error } = await db
    .from("campaign_products")
    .insert({ campaign_id: campaignId, product_id: productId, notes, sort_order: sortOrder })
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
): Promise<{ campaignId: string; campaignName: string; wfNumber: string }[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("campaign_products")
    .select("campaign_id, campaigns(name, wf_number)")
    .eq("product_id", productId);

  if (error) throw error;
  return (data || []).map((r) => {
    const campaign = (r as Record<string, unknown>).campaigns as Record<string, unknown>;
    return {
      campaignId: r.campaign_id,
      campaignName: (campaign?.name as string) || "",
      wfNumber: (campaign?.wf_number as string) || "",
    };
  });
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
