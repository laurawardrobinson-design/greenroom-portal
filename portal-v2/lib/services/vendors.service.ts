import { createAdminClient } from "@/lib/supabase/admin";
import type { Vendor } from "@/types/domain";
import type { CreateVendorInput, UpdateVendorInput } from "@/lib/validation/vendors.schema";

function toVendor(row: Record<string, unknown>): Vendor {
  return {
    id: row.id as string,
    companyName: row.company_name as string,
    contactName: row.contact_name as string,
    email: row.email as string,
    phone: row.phone as string,
    category: row.category as string,
    title: (row.title as string) || "",
    specialty: row.specialty as string,
    taxId: row.tax_id as string,
    active: row.active as boolean,
    onboardedDate: (row.onboarded_date as string) || null,
    notes: row.notes as string,
    favoriteDrinks: (row.favorite_drinks as string) || "",
    favoriteSnacks: (row.favorite_snacks as string) || "",
    dietaryRestrictions: (row.dietary_restrictions as string) || "",
    allergies: (row.allergies as string) || "",
    energyBoost: (row.energy_boost as string) || "",
    favoritePublixProduct: (row.favorite_publix_product as string) || "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function listVendors(filters?: {
  search?: string;
  category?: string;
  active?: boolean;
}): Promise<Vendor[]> {
  const db = createAdminClient();
  let query = db
    .from("vendors")
    .select("*")
    .order("company_name", { ascending: true });

  if (filters?.active !== undefined) {
    query = query.eq("active", filters.active);
  }
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.search) {
    query = query.or(
      `company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toVendor);
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return toVendor(data);
}

export async function createVendor(input: CreateVendorInput): Promise<Vendor> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("vendors")
    .insert({
      company_name: input.companyName,
      contact_name: input.contactName,
      email: input.email,
      phone: input.phone,
      category: input.category,
      specialty: input.specialty,
      tax_id: input.taxId,
      notes: input.notes,
      onboarded_date: new Date().toISOString().split("T")[0],
    })
    .select()
    .single();
  if (error) throw error;
  return toVendor(data);
}

export async function updateVendor(
  id: string,
  input: UpdateVendorInput
): Promise<Vendor> {
  const db = createAdminClient();
  const updateData: Record<string, unknown> = {};
  if (input.companyName !== undefined) updateData.company_name = input.companyName;
  if (input.contactName !== undefined) updateData.contact_name = input.contactName;
  if (input.email !== undefined) updateData.email = input.email;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.category !== undefined) updateData.category = input.category;
  if (input.specialty !== undefined) updateData.specialty = input.specialty;
  if (input.taxId !== undefined) updateData.tax_id = input.taxId;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.title !== undefined) updateData.title = input.title;
  if (input.favoriteDrinks !== undefined) updateData.favorite_drinks = input.favoriteDrinks;
  if (input.favoriteSnacks !== undefined) updateData.favorite_snacks = input.favoriteSnacks;
  if (input.dietaryRestrictions !== undefined) updateData.dietary_restrictions = input.dietaryRestrictions;
  if (input.allergies !== undefined) updateData.allergies = input.allergies;
  if (input.energyBoost !== undefined) updateData.energy_boost = input.energyBoost;
  if (input.favoritePublixProduct !== undefined) updateData.favorite_publix_product = input.favoritePublixProduct;

  const { data, error } = await db
    .from("vendors")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return toVendor(data);
}

export async function toggleVendorActive(
  id: string,
  active: boolean
): Promise<void> {
  const db = createAdminClient();
  const { error } = await db
    .from("vendors")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}
