import { createAdminClient } from "@/lib/supabase/admin";
import type { PRDepartment } from "@/types/domain";

export type ProductFlagReason = "inaccurate" | "about_to_change";
export type ProductFlagStatus = "open" | "resolved";

export interface ProductFlag {
  id: string;
  productId: string;
  flaggedByDept: PRDepartment;
  reason: ProductFlagReason;
  comment: string;
  status: ProductFlagStatus;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    itemCode: string | null;
    department: string;
    imageUrl: string | null;
  };
}

function toFlag(row: Record<string, unknown>): ProductFlag {
  const product = row.products as Record<string, unknown> | null;
  const resolver = row.resolved_by_user as Record<string, unknown> | null;
  return {
    id: row.id as string,
    productId: row.product_id as string,
    flaggedByDept: row.flagged_by_dept as PRDepartment,
    reason: row.reason as ProductFlagReason,
    comment: (row.comment as string) || "",
    status: row.status as ProductFlagStatus,
    resolvedBy: (row.resolved_by as string) || null,
    resolvedByName: (resolver?.name as string) || null,
    resolvedAt: (row.resolved_at as string) || null,
    resolutionNote: (row.resolution_note as string) || "",
    createdAt: row.created_at as string,
    product: product
      ? {
          id: product.id as string,
          name: product.name as string,
          itemCode: (product.item_code as string) || null,
          department: product.department as string,
          imageUrl: (product.image_url as string) || null,
        }
      : undefined,
  };
}

export async function createProductFlag(input: {
  productId: string;
  flaggedByDept: PRDepartment;
  reason: ProductFlagReason;
  comment: string;
}): Promise<ProductFlag> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .insert({
      product_id: input.productId,
      flagged_by_dept: input.flaggedByDept,
      reason: input.reason,
      comment: input.comment,
    })
    .select("*, products(id, name, item_code, department, image_url)")
    .single();
  if (error) throw error;
  return toFlag(data as Record<string, unknown>);
}

export async function listProductFlags(opts?: {
  status?: ProductFlagStatus;
}): Promise<ProductFlag[]> {
  const db = createAdminClient();
  let q = db
    .from("product_flags")
    .select(
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name)"
    )
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toFlag(r as Record<string, unknown>));
}

export async function resolveProductFlag(
  id: string,
  resolvedBy: string,
  resolutionNote = ""
): Promise<ProductFlag> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .update({
      status: "resolved",
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
      resolution_note: resolutionNote,
    })
    .eq("id", id)
    .select(
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toFlag(data as Record<string, unknown>);
}

// Returns a map of productId → open-flag count for a given id list.
// Used by the producer-facing inventory to badge flagged products.
export async function getOpenFlagCounts(
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .select("product_id")
    .eq("status", "open")
    .in("product_id", productIds);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const pid = (r as Record<string, unknown>).product_id as string;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }
  return counts;
}
