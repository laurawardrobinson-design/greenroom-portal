import { createAdminClient } from "@/lib/supabase/admin";
import type {
  PRDepartment,
  ProductImageType,
  ProductReferenceImage,
} from "@/types/domain";

// Shared bucket (same one gear/product single-image uploads use). Files
// for reference images live under `product-refs/<productId>/…` so they're
// easy to inventory per product and safe to prune on product delete.
const BUCKET = "gear-images";
const FOLDER_PREFIX = "product-refs";

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function toRow(row: Record<string, unknown>): ProductReferenceImage {
  const uploader = row.users as Record<string, unknown> | null | undefined;
  return {
    id: row.id as string,
    productId: row.product_id as string,
    imageType: row.image_type as ProductImageType,
    fileUrl: row.file_url as string,
    storagePath: (row.storage_path as string) || null,
    notes: (row.notes as string) || "",
    uploadedByUserId: (row.uploaded_by_user_id as string) || null,
    uploadedByUserName: uploader ? ((uploader.name as string) || null) : null,
    uploadedViaRbuDepartment: (row.uploaded_via_rbu_department as PRDepartment) || null,
    createdAt: row.created_at as string,
  };
}

export async function listProductReferenceImages(
  productId: string
): Promise<ProductReferenceImage[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_reference_images")
    .select("*, users:uploaded_by_user_id(name)")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRow);
}

/**
 * Upload a file to storage and return its public URL + storage path.
 * Used by both the portal API (Admin/BMM uploads) and the RBU token
 * API (RBU sample uploads).
 */
export async function uploadProductImageFile(
  productId: string,
  file: File
): Promise<{ fileUrl: string; storagePath: string }> {
  const db = createAdminClient();
  const timestamp = Date.now();
  const storagePath = `${FOLDER_PREFIX}/${productId}/${timestamp}-${safeFilename(file.name)}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath);
  return { fileUrl: urlData.publicUrl, storagePath };
}

/**
 * Create a reference-image row. Exactly one of `uploadedByUserId` or
 * `uploadedViaRbuDepartment` must be set (enforced by a table CHECK).
 */
export async function createProductReferenceImage(input: {
  productId: string;
  imageType: ProductImageType;
  fileUrl: string;
  storagePath?: string | null;
  notes?: string;
  uploadedByUserId?: string | null;
  uploadedViaRbuDepartment?: PRDepartment | null;
}): Promise<ProductReferenceImage> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_reference_images")
    .insert({
      product_id: input.productId,
      image_type: input.imageType,
      file_url: input.fileUrl,
      storage_path: input.storagePath ?? null,
      notes: (input.notes ?? "").trim(),
      uploaded_by_user_id: input.uploadedByUserId ?? null,
      uploaded_via_rbu_department: input.uploadedViaRbuDepartment ?? null,
    })
    .select("*, users:uploaded_by_user_id(name)")
    .single();
  if (error) throw error;
  return toRow(data as Record<string, unknown>);
}

export async function deleteProductReferenceImage(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: row } = await db
    .from("product_reference_images")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  const storagePath = (row as { storage_path: string | null } | null)?.storage_path;
  if (storagePath) {
    // Best-effort storage cleanup. Failure to remove the object
    // (e.g. file already gone) shouldn't block the row delete.
    await db.storage.from(BUCKET).remove([storagePath]).catch(() => {});
  }

  const { error } = await db
    .from("product_reference_images")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/**
 * Promote a sample to approved (RBU confirmed standard). The UI flow is
 * "this sample clears the bar" — update the type in place so the
 * timeline stays intact.
 */
export async function setProductReferenceImageType(
  id: string,
  imageType: ProductImageType
): Promise<ProductReferenceImage> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("product_reference_images")
    .update({ image_type: imageType })
    .eq("id", id)
    .select("*, users:uploaded_by_user_id(name)")
    .single();
  if (error) throw error;
  return toRow(data as Record<string, unknown>);
}
