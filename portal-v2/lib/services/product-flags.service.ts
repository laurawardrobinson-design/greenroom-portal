import { createAdminClient } from "@/lib/supabase/admin";
import type { PRDepartment } from "@/types/domain";

export type ProductFlagReason = "inaccurate" | "about_to_change";
export type ProductFlagStatus = "open" | "resolved";
export type ProductFlagSource = "rbu" | "producer";

export interface ProductFlag {
  id: string;
  productId: string;
  flaggedByDept: PRDepartment;
  source: ProductFlagSource;
  raisedByUserId: string | null;
  raisedByName: string | null;
  reason: ProductFlagReason;
  comment: string;
  status: ProductFlagStatus;
  resolvedBy: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string;
  createdAt: string;
  editedAt: string | null;
  product?: {
    id: string;
    name: string;
    itemCode: string | null;
    department: string;
    imageUrl: string | null;
  };
}

export interface ProductFlagComment {
  id: string;
  flagId: string;
  authorUserId: string | null;
  authorUserName: string | null;
  authorDept: PRDepartment | null;
  authorLabel: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

function toFlag(row: Record<string, unknown>): ProductFlag {
  const product = row.products as Record<string, unknown> | null;
  const resolver = row.resolved_by_user as Record<string, unknown> | null;
  const raiser = row.raised_by_user as Record<string, unknown> | null;
  return {
    id: row.id as string,
    productId: row.product_id as string,
    flaggedByDept: row.flagged_by_dept as PRDepartment,
    source: ((row.source as string) ?? "rbu") as ProductFlagSource,
    raisedByUserId: (row.raised_by_user_id as string) || null,
    raisedByName: (raiser?.name as string) || null,
    reason: row.reason as ProductFlagReason,
    comment: (row.comment as string) || "",
    status: row.status as ProductFlagStatus,
    resolvedBy: (row.resolved_by as string) || null,
    resolvedByName: (resolver?.name as string) || null,
    resolvedAt: (row.resolved_at as string) || null,
    resolutionNote: (row.resolution_note as string) || "",
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string) || null,
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

function toComment(row: Record<string, unknown>): ProductFlagComment {
  const author = row.author_user as Record<string, unknown> | null;
  return {
    id: row.id as string,
    flagId: row.flag_id as string,
    authorUserId: (row.author_user_id as string) || null,
    authorUserName: (author?.name as string) || null,
    authorDept: (row.author_dept as PRDepartment) || null,
    authorLabel: (row.author_label as string) || "",
    body: row.body as string,
    createdAt: row.created_at as string,
    editedAt: (row.edited_at as string) || null,
  };
}

export async function updateProductFlagComment(input: {
  commentId: string;
  authorUserId: string;
  body: string;
}): Promise<ProductFlagComment> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flag_comments")
    .update({
      body: input.body,
      edited_at: new Date().toISOString(),
    })
    .eq("id", input.commentId)
    .eq("author_user_id", input.authorUserId)
    .select(
      "*, author_user:users!product_flag_comments_author_user_id_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toComment(data as Record<string, unknown>);
}

export async function updateProductFlagBody(input: {
  flagId: string;
  raisedByUserId: string;
  comment: string;
}): Promise<ProductFlag> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .update({
      comment: input.comment,
      edited_at: new Date().toISOString(),
    })
    .eq("id", input.flagId)
    .eq("raised_by_user_id", input.raisedByUserId)
    .select(
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name), raised_by_user:users!product_flags_raised_by_user_id_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toFlag(data as Record<string, unknown>);
}

export async function createProductFlag(input: {
  productId: string;
  flaggedByDept: PRDepartment;
  reason: ProductFlagReason;
  comment: string;
  source?: ProductFlagSource;
  raisedByUserId?: string | null;
}): Promise<ProductFlag> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .insert({
      product_id: input.productId,
      flagged_by_dept: input.flaggedByDept,
      reason: input.reason,
      comment: input.comment,
      source: input.source ?? "rbu",
      raised_by_user_id: input.raisedByUserId ?? null,
    })
    .select(
      "*, products(id, name, item_code, department, image_url), raised_by_user:users!product_flags_raised_by_user_id_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toFlag(data as Record<string, unknown>);
}

export async function listProductFlags(opts?: {
  status?: ProductFlagStatus;
  dept?: PRDepartment;
  productId?: string;
}): Promise<ProductFlag[]> {
  const db = createAdminClient();
  let q = db
    .from("product_flags")
    .select(
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name), raised_by_user:users!product_flags_raised_by_user_id_fkey(name)"
    )
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.dept) q = q.eq("flagged_by_dept", opts.dept);
  if (opts?.productId) q = q.eq("product_id", opts.productId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toFlag(r as Record<string, unknown>));
}

export async function listProductFlagComments(
  flagId: string
): Promise<ProductFlagComment[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flag_comments")
    .select(
      "*, author_user:users!product_flag_comments_author_user_id_fkey(name)"
    )
    .eq("flag_id", flagId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => toComment(r as Record<string, unknown>));
}

export async function addProductFlagComment(input: {
  flagId: string;
  body: string;
  authorUserId?: string | null;
  authorDept?: PRDepartment | null;
  authorLabel?: string;
}): Promise<ProductFlagComment> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flag_comments")
    .insert({
      flag_id: input.flagId,
      body: input.body,
      author_user_id: input.authorUserId ?? null,
      author_dept: input.authorDept ?? null,
      author_label: input.authorLabel ?? "",
    })
    .select(
      "*, author_user:users!product_flag_comments_author_user_id_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toComment(data as Record<string, unknown>);
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
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name), raised_by_user:users!product_flags_raised_by_user_id_fkey(name)"
    )
    .single();
  if (error) throw error;
  return toFlag(data as Record<string, unknown>);
}

export async function reopenProductFlag(id: string): Promise<ProductFlag> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_flags")
    .update({
      status: "open",
      resolved_by: null,
      resolved_at: null,
      resolution_note: "",
    })
    .eq("id", id)
    .select(
      "*, products(id, name, item_code, department, image_url), resolved_by_user:users!product_flags_resolved_by_fkey(name), raised_by_user:users!product_flags_raised_by_user_id_fkey(name)"
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
