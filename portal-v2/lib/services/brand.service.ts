import { createClient } from "@/lib/supabase/server";
import type { BrandTokenSet, BrandTokenPayload } from "@/types/domain";

function toBrandTokenSet(row: Record<string, unknown>): BrandTokenSet {
  return {
    id: row.id as string,
    brand: row.brand as string,
    version: row.version as number,
    isActive: Boolean(row.is_active),
    notes: (row.notes as string) ?? "",
    tokens: (row.tokens as BrandTokenPayload) ?? {},
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** All brand token sets, newest version first per brand. */
export async function listBrandTokens(brand?: string): Promise<BrandTokenSet[]> {
  const supabase = await createClient();
  let q = supabase
    .from("brand_tokens")
    .select("*")
    .order("brand")
    .order("version", { ascending: false });
  if (brand) q = q.eq("brand", brand);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toBrandTokenSet);
}

/** The currently active token set for a brand (defaults to Publix). */
export async function getActiveBrandTokens(brand = "Publix"): Promise<BrandTokenSet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_tokens")
    .select("*")
    .eq("brand", brand)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return null;
  return data ? toBrandTokenSet(data) : null;
}

export async function getBrandTokens(id: string): Promise<BrandTokenSet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_tokens")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return toBrandTokenSet(data);
}

/**
 * Create a new brand token version. The new version number is max(version)+1
 * for that brand. If activate=true, also flips is_active (deactivating siblings).
 */
export async function createBrandTokenVersion(input: {
  brand?: string;
  notes?: string;
  tokens: BrandTokenPayload;
  activate?: boolean;
  createdBy?: string | null;
}): Promise<BrandTokenSet> {
  const supabase = await createClient();
  const brand = input.brand ?? "Publix";

  // Compute next version
  const { data: maxRow } = await supabase
    .from("brand_tokens")
    .select("version")
    .eq("brand", brand)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((maxRow?.version as number | undefined) ?? 0) + 1;

  // If activating, deactivate existing active row first
  if (input.activate) {
    await supabase
      .from("brand_tokens")
      .update({ is_active: false })
      .eq("brand", brand)
      .eq("is_active", true);
  }

  const { data, error } = await supabase
    .from("brand_tokens")
    .insert({
      brand,
      version: nextVersion,
      is_active: input.activate ?? false,
      notes: input.notes ?? "",
      tokens: input.tokens,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toBrandTokenSet(data);
}

/** Flip is_active for a specific token set. Deactivates other versions in the same brand. */
export async function activateBrandTokens(id: string): Promise<BrandTokenSet> {
  const supabase = await createClient();

  // Fetch to learn the brand
  const { data: target, error: fetchErr } = await supabase
    .from("brand_tokens")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) throw fetchErr;

  // Deactivate all others for this brand
  await supabase
    .from("brand_tokens")
    .update({ is_active: false })
    .eq("brand", target.brand);

  // Activate target
  const { data, error } = await supabase
    .from("brand_tokens")
    .update({ is_active: true })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toBrandTokenSet(data);
}

export async function updateBrandTokensPayload(
  id: string,
  patch: { tokens?: BrandTokenPayload; notes?: string }
): Promise<BrandTokenSet> {
  const supabase = await createClient();
  const body: Record<string, unknown> = {};
  if (patch.tokens !== undefined) body.tokens = patch.tokens;
  if (patch.notes !== undefined) body.notes = patch.notes;
  const { data, error } = await supabase
    .from("brand_tokens")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return toBrandTokenSet(data);
}
